import cookieParser from 'cookie-parser';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../app.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireCompletedOnboarding } from '../../middleware/requireCompletedOnboarding.js';
import Session from './model/Session.js';
import User from '../users/model/User.js';

let mongo: MongoMemoryServer;
let cookie: string;
let userId: string;
const gated = express();
gated.use(cookieParser());
gated.get('/completed-only', requireAuth, requireCompletedOnboarding, (_request, response) => {
  response.json({ allowed: true });
});
gated.use(errorHandler);

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), Session.init()]);
  const signup = await request(app).post('/api/v1/auth/signup').send({
    name: 'Access User',
    email: 'access@example.test',
    password: 'password-123'
  });
  if (signup.status !== 201) throw new Error(`Signup failed: ${signup.status}`);
  cookie = String(signup.headers['set-cookie']?.[0]).split(';')[0];
  userId = signup.body.data.user.id;
  await User.updateOne({ _id: userId }, { $set: { emailVerifiedAt: new Date() } });
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

describe('session and account authorization', () => {
  it('returns status without exposing secrets', async () => {
    const response = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({
      id: userId,
      accountStatus: 'ACTIVE',
      onboardingStatus: 'NOT_STARTED'
    });
    expect(response.body.data.user).not.toHaveProperty('passwordHash');
    expect(response.body.data.user).not.toHaveProperty('tokenHash');
  });

  it('rejects missing and invalid sessions while allowing onboarding with a valid session', async () => {
    expect((await request(app).get('/api/v1/onboarding')).status).toBe(401);
    expect(
      (
        await request(app)
          .get('/api/v1/onboarding')
          .set('Cookie', `voklance_session=${'aa'.repeat(32)}`)
      ).status
    ).toBe(401);
    expect((await request(app).get('/api/v1/onboarding').set('Cookie', cookie)).status).toBe(200);
  });

  it('gates only routes explicitly configured for completed onboarding', async () => {
    const incomplete = await request(gated).get('/completed-only').set('Cookie', cookie);
    expect(incomplete.status).toBe(403);
    expect(incomplete.body.error.code).toBe('ONBOARDING_REQUIRED');
    await User.updateOne({ _id: userId }, { $set: { onboardingStatus: 'COMPLETED' } });
    expect((await request(gated).get('/completed-only').set('Cookie', cookie)).status).toBe(200);
    expect((await request(app).get('/api/v1/onboarding').set('Cookie', cookie)).status).toBe(200);
    await User.updateOne({ _id: userId }, { $set: { onboardingStatus: 'NOT_STARTED' } });
  });

  it('rejects an expired session', async () => {
    const session = await Session.findOne({ userId });
    if (!session) throw new Error('Missing test session');
    await Session.updateOne({ _id: session._id }, { $set: { expiresAt: new Date(0) } });
    const response = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('SESSION_EXPIRED');
    await Session.updateOne({ _id: session._id }, { $set: { expiresAt: new Date(Date.now() + 60_000) } });
  });

  it('blocks suspended and deactivated accounts but keeps logout available', async () => {
    await User.updateOne({ _id: userId }, { $set: { accountStatus: 'SUSPENDED' } });
    const suspended = await request(app).get('/api/v1/profiles/me').set('Cookie', cookie);
    expect(suspended.status).toBe(403);
    expect(suspended.body.error.code).toBe('ACCOUNT_SUSPENDED');
    expect((await request(app).get('/api/v1/onboarding').set('Cookie', cookie)).status).toBe(403);
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', cookie)).status).toBe(403);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'access@example.test', password: 'password-123' });
    expect(login.status).toBe(403);
    expect(login.body.error.code).toBe('ACCOUNT_SUSPENDED');
    await User.updateOne({ _id: userId }, { $set: { accountStatus: 'DEACTIVATED' } });
    expect((await request(app).get('/api/v1/onboarding').set('Cookie', cookie)).body.error.code).toBe(
      'ACCOUNT_DEACTIVATED'
    );
    expect((await request(app).post('/api/v1/auth/logout').set('Cookie', cookie)).status).toBe(200);
  });
});
