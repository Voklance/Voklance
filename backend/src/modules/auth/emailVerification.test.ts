import cookieParser from 'cookie-parser';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../../app.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireVerifiedEmail } from '../../middleware/requireVerifiedEmail.js';
import { setEmailProviderForTests } from '../../services/email/emailService.js';
import User from '../users/model/User.js';
import EmailVerificationToken from './model/EmailVerificationToken.js';
import EmailVerificationThrottle from './model/EmailVerificationThrottle.js';
import { hashPassword } from './service/passwordService.js';

vi.mock('../../config/env.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../config/env.js')>();
  return { ...actual, env: { ...actual.env, emailVerificationEnabled: true } };
});

let mongo: MongoMemoryServer;
const links: string[] = [];
let accepts = true;
let sequence = 0;
const gate = express();
gate.use(cookieParser());
gate.get('/protected', requireAuth, requireVerifiedEmail, (_request, response) =>
  response.json({ allowed: true })
);
gate.use(errorHandler);

function latestToken() {
  const url = new URL(links.at(-1) ?? 'http://localhost/');
  return new URLSearchParams(url.hash.slice(1)).get('token') ?? '';
}

async function signup() {
  sequence += 1;
  const response = await request(app)
    .post('/api/v1/auth/signup')
    .send({
      name: 'Verification User',
      email: `verify${sequence}@example.test`,
      password: 'password-123'
    });
  expect(response.status).toBe(201);
  return { response, cookie: String(response.headers['set-cookie']?.[0]).split(';')[0] };
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), EmailVerificationToken.init(), EmailVerificationThrottle.init()]);
  setEmailProviderForTests({
    async send(message) {
      links.push(message.text.match(/https?:\/\/\S+/)?.[0] ?? '');
      return accepts;
    }
  });
}, 120_000);
beforeEach(() => {
  accepts = true;
});
afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

describe('email verification', () => {
  it('creates an unverified account and stores only a token hash', async () => {
    const { response, cookie } = await signup();
    expect(response.body.data.verificationEmailSent).toBe(true);
    expect(response.body.data.user).toMatchObject({ emailVerifiedAt: null, emailVerificationRequired: true });
    const token = latestToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const stored = await EmailVerificationToken.findOne({ userId: response.body.data.user.id });
    expect(stored?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored?.tokenHash).not.toBe(token);
    expect(stored?.expiresAt.getTime()).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1000);
    expect((await request(gate).get('/protected').set('Cookie', cookie)).body.error.code).toBe(
      'EMAIL_VERIFICATION_REQUIRED'
    );
    expect((await request(app).get('/api/v1/onboarding').set('Cookie', cookie)).body.error.code).toBe(
      'EMAIL_VERIFICATION_REQUIRED'
    );
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', cookie)).status).toBe(200);
  });

  it('consumes a token once, persists verification, and preserves the session', async () => {
    const { response, cookie } = await signup();
    const token = latestToken();
    const verified = await request(app).post('/api/v1/auth/verify-email').send({ token });
    expect(verified.status).toBe(200);
    expect(verified.body.data.verified).toBe(true);
    expect((await request(app).post('/api/v1/auth/verify-email').send({ token })).status).toBe(400);
    expect(await EmailVerificationToken.countDocuments({ userId: response.body.data.user.id })).toBe(0);
    expect(
      (await request(app).get('/api/v1/auth/me').set('Cookie', cookie)).body.data.user.emailVerifiedAt
    ).toBeTruthy();
    expect((await request(gate).get('/protected').set('Cookie', cookie)).status).toBe(200);
  });

  it('rejects invalid and expired tokens', async () => {
    expect(
      (
        await request(app)
          .post('/api/v1/auth/verify-email')
          .send({ token: 'x'.repeat(43) })
      ).status
    ).toBe(400);
    const { response } = await signup();
    const token = latestToken();
    await EmailVerificationToken.updateOne(
      { userId: response.body.data.user.id },
      { $set: { expiresAt: new Date(0) } }
    );
    expect((await request(app).post('/api/v1/auth/verify-email').send({ token })).status).toBe(400);
  });

  it('allows only one concurrent verification', async () => {
    await signup();
    const token = latestToken();
    const outcomes = await Promise.all(
      Array.from({ length: 2 }, () => request(app).post('/api/v1/auth/verify-email').send({ token }))
    );
    expect(outcomes.map((result) => result.status).sort()).toEqual([200, 400]);
  });

  it('resends a new token, enforces cooldown and hourly limits in MongoDB', async () => {
    const { response, cookie } = await signup();
    const oldToken = latestToken();
    const first = await request(app).post('/api/v1/auth/resend-verification').set('Cookie', cookie);
    expect(first.status).toBe(200);
    expect(latestToken()).not.toBe(oldToken);
    expect((await request(app).post('/api/v1/auth/resend-verification').set('Cookie', cookie)).status).toBe(
      429
    );
    const userKey = `user:${response.body.data.user.id}`;
    await EmailVerificationThrottle.updateOne(
      { key: userKey },
      { $set: { nextAllowedAt: new Date(0), count: 5 } }
    );
    const limited = await request(app).post('/api/v1/auth/resend-verification').set('Cookie', cookie);
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('VERIFICATION_RATE_LIMITED');
    // The original link stays usable until verification succeeds.
    expect((await request(app).post('/api/v1/auth/verify-email').send({ token: oldToken })).status).toBe(200);
    expect(
      (await request(app).post('/api/v1/auth/resend-verification').set('Cookie', cookie)).body.error.code
    ).toBe('EMAIL_ALREADY_VERIFIED');
  });

  it('keeps signup unverified and reports a failed delivery without a usable unsent token', async () => {
    accepts = false;
    const { response, cookie } = await signup();
    expect(response.body.data.verificationEmailSent).toBe(false);
    expect(await EmailVerificationToken.countDocuments({ userId: response.body.data.user.id })).toBe(0);
    expect(
      (await request(app).get('/api/v1/auth/me').set('Cookie', cookie)).body.data.user.emailVerifiedAt
    ).toBeNull();
  });

  it('reports resend delivery failure and preserves the earlier token', async () => {
    const { response, cookie } = await signup();
    const firstToken = latestToken();
    accepts = false;
    const resend = await request(app).post('/api/v1/auth/resend-verification').set('Cookie', cookie);
    expect(resend.status).toBe(503);
    expect(resend.body.error.code).toBe('EMAIL_DELIVERY_UNAVAILABLE');
    expect(await EmailVerificationToken.countDocuments({ userId: response.body.data.user.id })).toBe(1);
    expect((await request(app).post('/api/v1/auth/verify-email').send({ token: firstToken })).status).toBe(
      200
    );
  });

  it('uses a shared IP counter to reject excessive resend attempts', async () => {
    const { cookie } = await signup();
    const first = await request(app).post('/api/v1/auth/resend-verification').set('Cookie', cookie);
    expect(first.status).toBe(200);
    const ipThrottle = await EmailVerificationThrottle.findOne({ key: /^ip:/ });
    expect(ipThrottle).not.toBeNull();
    await EmailVerificationThrottle.updateOne(
      { _id: ipThrottle?._id },
      { $set: { count: 20, nextAllowedAt: new Date(0) } }
    );
    const another = await signup();
    const limited = await request(app).post('/api/v1/auth/resend-verification').set('Cookie', another.cookie);
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('VERIFICATION_RATE_LIMITED');
  });

  it('does not turn legacy accounts into verified accounts or block their existing access', async () => {
    const email = `legacy${++sequence}@example.test`;
    const user = await User.create({
      name: 'Legacy',
      email,
      passwordHash: await hashPassword('password-123'),
      onboardingStatus: 'COMPLETED'
    });
    expect(user.emailVerifiedAt).toBeUndefined();
    expect(user.emailVerificationRequired).toBeUndefined();
    // No migration or automatic verification is applied to this record.
    expect((await User.findById(user._id))?.emailVerifiedAt).toBeUndefined();
    const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'password-123' });
    expect(login.status).toBe(200);
    const cookie = String(login.headers['set-cookie']?.[0]).split(';')[0];
    expect((await request(app).get('/api/v1/onboarding').set('Cookie', cookie)).status).toBe(200);
  });
});
