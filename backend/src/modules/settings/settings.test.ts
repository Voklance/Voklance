import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../app.js';
import { setEmailProviderForTests } from '../../services/email/emailService.js';
import User from '../users/model/User.js';
import Profile from '../profiles/model/Profile.js';
import Session from '../auth/model/Session.js';
import PasswordResetToken from '../auth/model/PasswordResetToken.js';
import EmailChangeToken from './model/EmailChangeToken.js';
let mongo: MongoMemoryServer;
let cookie = '';
let userId = '';
const mail: { to: string; text: string }[] = [];
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([
    User.init(),
    Profile.init(),
    Session.init(),
    PasswordResetToken.init(),
    EmailChangeToken.init()
  ]);
  setEmailProviderForTests({
    send: async (message) => {
      mail.push({ to: message.to, text: message.text });
      return true;
    }
  });
  const result = await request(app)
    .post('/api/v1/auth/signup')
    .send({ name: 'Settings User', email: 'settings@example.test', password: 'original-password' });
  userId = result.body.data.user.id;
  cookie = String(result.headers['set-cookie']?.[0]).split(';')[0];
  await User.updateOne({ _id: userId }, { $set: { onboardingStatus: 'COMPLETED' } });
  await Profile.create({
    userId,
    username: 'settings-user',
    fullName: 'Settings User',
    headline: 'Engineer',
    country: 'India',
    visibility: 'PRIVATE'
  });
}, 120_000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
const auth = () => ({ Cookie: cookie });
describe('account security and settings', () => {
  it('keeps account fields allowlisted, updates privacy, and never returns session hashes', async () => {
    const info = await request(app).get('/api/v1/settings/account').set(auth());
    expect(info.status).toBe(200);
    expect(info.body.data.email).toBe('settings@example.test');
    expect(JSON.stringify(info.body)).not.toContain('passwordHash');
    expect(
      (
        await request(app)
          .patch('/api/v1/settings/account')
          .set(auth())
          .send({ name: 'Updated Name', role: 'admin' })
      ).status
    ).toBe(400);
    expect(
      (await request(app).patch('/api/v1/settings/account').set(auth()).send({ name: 'Updated Name' })).body
        .data.name
    ).toBe('Updated Name');
    const privacy = await request(app)
      .patch('/api/v1/settings/privacy')
      .set(auth())
      .send({ visibility: 'PUBLIC', profileDiscoverable: false });
    expect(privacy.body.data.settings.profileDiscoverable).toBe(false);
    const sessions = await request(app).get('/api/v1/settings/security/sessions').set(auth());
    expect(sessions.body.data.items[0].current).toBe(true);
    expect(JSON.stringify(sessions.body)).not.toContain('tokenHash');
    expect(JSON.stringify(sessions.body)).not.toContain(cookie.split('=')[1]);
  });
  it('uses a single-use reset link and invalidates old sessions', async () => {
    const unknown = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'unknown@example.test' });
    const known = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'settings@example.test' });
    expect(known.status).toBe(200);
    expect(known.body.message).toBe(unknown.body.message);
    const text = mail.findLast(
      (item) => item.to === 'settings@example.test' && item.text.includes('reset-password')
    )!.text;
    const link = text.match(/https?:\/\/\S+reset-password#token=[A-Za-z0-9_-]+/)![0];
    const token = new URL(link).hash.slice('#token='.length);
    const reset = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, newPassword: 'new-secure-password', confirmPassword: 'new-secure-password' });
    expect(reset.status).toBe(200);
    expect((await request(app).get('/api/v1/auth/me').set(auth())).status).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/reset-password')
          .send({ token, newPassword: 'another-secure-password', confirmPassword: 'another-secure-password' })
      ).status
    ).toBe(400);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'settings@example.test', password: 'new-secure-password' });
    expect(login.status).toBe(200);
    cookie = String(login.headers['set-cookie']?.[0]).split(';')[0];
  });
  it('confirms email change before replacing the old address, then deactivates and reactivates', async () => {
    const requested = await request(app)
      .post('/api/v1/settings/account/email-change')
      .set(auth())
      .send({ currentPassword: 'new-secure-password', newEmail: 'changed@example.test' });
    expect(requested.status).toBe(200);
    expect((await User.findById(userId).lean())!.email).toBe('settings@example.test');
    const text = mail.findLast((item) => item.to === 'changed@example.test')!.text;
    const link = text.match(/https?:\/\/\S+confirm-email-change#token=[A-Za-z0-9_-]+/)![0];
    const token = new URL(link).hash.slice('#token='.length);
    expect(
      (await request(app).post('/api/v1/settings/account/email-change/confirm').set(auth()).send({ token }))
        .status
    ).toBe(200);
    expect((await request(app).get('/api/v1/auth/me').set(auth())).status).toBe(401);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'changed@example.test', password: 'new-secure-password' });
    expect(login.status).toBe(200);
    cookie = String(login.headers['set-cookie']?.[0]).split(';')[0];
    expect(
      (
        await request(app)
          .post('/api/v1/settings/account/deactivate')
          .set(auth())
          .send({ currentPassword: 'new-secure-password', confirmation: 'DEACTIVATE' })
      ).status
    ).toBe(200);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'changed@example.test', password: 'new-secure-password' })
      ).status
    ).toBe(403);
    const reactivated = await request(app)
      .post('/api/v1/auth/reactivate')
      .send({ email: 'changed@example.test', password: 'new-secure-password' });
    expect(reactivated.status).toBe(200);
    cookie = String(reactivated.headers['set-cookie']?.[0]).split(';')[0];
  });
  it('requires the current password for export and gates unsafe deletion', async () => {
    expect(
      (
        await request(app)
          .post('/api/v1/settings/data/export')
          .set(auth())
          .send({ currentPassword: 'wrong-password' })
      ).status
    ).toBe(403);
    const exported = await request(app)
      .post('/api/v1/settings/data/export')
      .set(auth())
      .send({ currentPassword: 'new-secure-password' });
    expect(exported.status).toBe(200);
    expect(exported.body.account.email).toBe('changed@example.test');
    expect(JSON.stringify(exported.body)).not.toContain('passwordHash');
    expect((await request(app).post('/api/v1/settings/account/delete').set(auth())).status).toBe(503);
  });
});
