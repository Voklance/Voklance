import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../app.js';
import User from '../users/model/User.js';
import Profile from './model/Profile.js';
import Skill from '../skills/model/Skill.js';
import UserSkill from '../skills/model/UserSkill.js';
import ProfessionalExperience from './model/ProfessionalExperience.js';
import Education from './model/Education.js';

let mongo: MongoMemoryServer;
let cookie = '';
let ownerId = '';

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([
    User.init(),
    Profile.init(),
    Skill.init(),
    UserSkill.init(),
    ProfessionalExperience.init(),
    Education.init()
  ]);
  const signup = await request(app)
    .post('/api/v1/auth/signup')
    .send({ name: 'Ada Developer', email: 'ada@example.test', password: 'password-123' });
  if (signup.status !== 201) throw new Error('Could not create profile test account.');
  cookie = String(signup.headers['set-cookie']?.[0]).split(';')[0];
  ownerId = signup.body.data.user.id;
}, 120_000);
afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

describe('professional profile privacy and links', () => {
  it('requires a session for profile updates and validates URLs', async () => {
    expect((await request(app).patch('/api/v1/profiles/me').send({ headline: 'Engineer' })).status).toBe(401);
    const unsafe = await request(app).patch('/api/v1/profiles/me').set('Cookie', cookie).send({
      username: 'ada-dev',
      fullName: 'Ada Developer',
      headline: 'Engineer',
      country: 'India',
      websiteUrl: 'javascript:alert(1)'
    });
    expect(unsafe.status).toBe(400);
    const wrongGithub = await request(app).patch('/api/v1/profiles/me').set('Cookie', cookie).send({
      username: 'ada-dev',
      fullName: 'Ada Developer',
      headline: 'Engineer',
      country: 'India',
      githubUrl: 'https://example.test/ada'
    });
    expect(wrongGithub.status).toBe(400);
  });

  it('keeps a new profile private until its owner publishes it', async () => {
    const created = await request(app).patch('/api/v1/profiles/me').set('Cookie', cookie).send({
      username: 'Ada-Dev',
      fullName: 'Ada Developer',
      headline: 'Software Engineer',
      country: 'India',
      bio: 'Building useful software.',
      githubUrl: 'https://github.com/ada-dev'
    });
    expect(created.status).toBe(200);
    expect(created.body.data.profile).toMatchObject({ username: 'ada-dev', visibility: 'PRIVATE' });
    expect((await request(app).get('/api/v1/profiles/ada-dev')).status).toBe(404);
    expect(
      (await request(app).get('/api/v1/profiles/me').set('Cookie', cookie)).body.data.profile.headline
    ).toBe('Software Engineer');
    const unpublished = await User.findById(ownerId).lean();
    expect(unpublished?.email).toBe('ada@example.test');
  });

  it('returns only allowlisted public details for an active completed owner', async () => {
    const publishedWhileIncomplete = await request(app)
      .patch('/api/v1/profiles/me')
      .set('Cookie', cookie)
      .send({ visibility: 'PUBLIC' });
    expect(publishedWhileIncomplete.status).toBe(200);
    expect((await request(app).get('/api/v1/profiles/ada-dev')).status).toBe(404);
    await User.updateOne({ _id: ownerId }, { $set: { onboardingStatus: 'COMPLETED' } });
    const skill = await Skill.create({ name: 'TypeScript', slug: 'typescript', category: 'Engineering' });
    await UserSkill.create({ userId: ownerId, skillId: skill._id });
    await ProfessionalExperience.create({
      userId: ownerId,
      jobTitle: 'Engineer',
      companyName: 'Example',
      startDate: new Date('2023-01-01'),
      isCurrent: true
    });
    await Education.create({ userId: ownerId, institution: 'University', startDate: new Date('2019-01-01') });
    const updated = await request(app)
      .patch('/api/v1/profiles/me')
      .set('Cookie', cookie)
      .send({ visibility: 'PUBLIC', portfolioUrl: 'https://portfolio.example.test/' });
    expect(updated.status).toBe(200);
    const publicProfile = await request(app).get('/api/v1/profiles/ADA-DEV');
    expect(publicProfile.status).toBe(200);
    expect(publicProfile.body.data.profile).toMatchObject({
      username: 'ada-dev',
      headline: 'Software Engineer',
      githubUrl: 'https://github.com/ada-dev',
      portfolioUrl: 'https://portfolio.example.test/'
    });
    expect(publicProfile.body.data.skills).toHaveLength(1);
    expect(publicProfile.body.data.experiences).toHaveLength(1);
    expect(publicProfile.body.data.education).toHaveLength(1);
    for (const field of [
      'id',
      'email',
      'passwordHash',
      'accountStatus',
      'onboardingStatus',
      'userId',
      'visibility',
      'avatarUrl'
    ])
      expect(publicProfile.body.data.profile).not.toHaveProperty(field);
    expect((await request(app).get('/api/v1/profiles/unknown-user')).status).toBe(404);
  });

  it('hides suspended and unpublished profiles and allows link removal', async () => {
    await User.updateOne({ _id: ownerId }, { $set: { accountStatus: 'SUSPENDED' } });
    expect((await request(app).get('/api/v1/profiles/ada-dev')).status).toBe(404);
    await User.updateOne({ _id: ownerId }, { $set: { accountStatus: 'ACTIVE' } });
    const removed = await request(app)
      .patch('/api/v1/profiles/me')
      .set('Cookie', cookie)
      .send({ githubUrl: null, visibility: 'PRIVATE' });
    expect(removed.status).toBe(200);
    expect(removed.body.data.profile).not.toHaveProperty('githubUrl');
    expect((await request(app).get('/api/v1/profiles/ada-dev')).status).toBe(404);
  });

  it('does not allow another user to take an existing username', async () => {
    const second = await request(app)
      .post('/api/v1/auth/signup')
      .send({ name: 'Other User', email: 'other@example.test', password: 'password-123' });
    const otherCookie = String(second.headers['set-cookie']?.[0]).split(';')[0];
    const conflict = await request(app)
      .patch('/api/v1/profiles/me')
      .set('Cookie', otherCookie)
      .send({ username: 'ada-dev', fullName: 'Other User', headline: 'Analyst', country: 'India' });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('USERNAME_TAKEN');
    expect(await Profile.countDocuments({ userId: ownerId })).toBe(1);
  });

  it('supports a published username that collides with the username-check route', async () => {
    const signup = await request(app)
      .post('/api/v1/auth/signup')
      .send({ name: 'Me User', email: 'me-user@example.test', password: 'password-123' });
    const meCookie = String(signup.headers['set-cookie']?.[0]).split(';')[0];
    await User.updateOne({ _id: signup.body.data.user.id }, { $set: { onboardingStatus: 'COMPLETED' } });
    const created = await request(app).patch('/api/v1/profiles/me').set('Cookie', meCookie).send({
      username: 'check-username',
      fullName: 'Me User',
      headline: 'Researcher',
      country: 'India',
      visibility: 'PUBLIC'
    });
    expect(created.status).toBe(200);
    expect(
      (await request(app).get('/api/v1/profiles/public/check-username')).body.data.profile.username
    ).toBe('check-username');
    expect((await request(app).get('/api/v1/profiles/check-username')).status).toBe(401);
  });
});
