import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import app from '../../app.js';
import { setEmailProviderForTests } from '../../services/email/emailService.js';
import User from '../users/model/User.js';
import Session from './model/Session.js';
import EmailVerificationToken from './model/EmailVerificationToken.js';

vi.mock('../../config/env.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../config/env.js')>();
  return { ...actual, env: { ...actual.env, emailVerificationEnabled: false } };
});

let mongo: MongoMemoryServer;
let delivered = 0;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), Session.init(), EmailVerificationToken.init()]);
  setEmailProviderForTests({
    async send() {
      delivered += 1;
      return true;
    }
  });
}, 120_000);
afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

describe('email verification switch off', () => {
  it('signs up without sending email or creating a token, and allows onboarding', async () => {
    const signup = await request(app).post('/api/v1/auth/signup').send({
      name: 'Feature Off',
      email: 'feature-off@example.test',
      password: 'password-123'
    });
    expect(signup.status).toBe(201);
    expect(signup.body.data.verificationEmailSent).toBe(false);
    expect(signup.body.data.user).toMatchObject({ emailVerificationRequired: false, emailVerifiedAt: null });
    expect(delivered).toBe(0);
    expect(await EmailVerificationToken.countDocuments()).toBe(0);
    const cookie = String(signup.headers['set-cookie']?.[0]).split(';')[0];
    expect((await request(app).get('/api/v1/onboarding').set('Cookie', cookie)).status).toBe(200);
    const verify = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token: 'x'.repeat(43) });
    expect(verify.status).toBe(503);
    expect(verify.body.error.code).toBe('EMAIL_VERIFICATION_DISABLED');
    const resend = await request(app).post('/api/v1/auth/resend-verification').set('Cookie', cookie);
    expect(resend.status).toBe(503);
    expect(resend.body.error.code).toBe('EMAIL_VERIFICATION_DISABLED');
  });

  it('lets an older pending account access onboarding while the switch is off', async () => {
    const signup = await request(app).post('/api/v1/auth/signup').send({
      name: 'Older Pending',
      email: 'older-pending@example.test',
      password: 'password-123'
    });
    await User.updateOne({ _id: signup.body.data.user.id }, { $set: { emailVerificationRequired: true } });
    const cookie = String(signup.headers['set-cookie']?.[0]).split(';')[0];
    const me = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);
    expect(me.body.data.user.emailVerificationRequired).toBe(false);
    expect((await request(app).get('/api/v1/onboarding').set('Cookie', cookie)).status).toBe(200);
  });
});
