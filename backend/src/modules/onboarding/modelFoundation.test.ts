import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../app.js';
import { catalogUpserts, interestSeeds, skillSeeds } from '../../database/catalogSeeds.js';
import { hashPassword } from '../auth/service/passwordService.js';
import Interest from '../interests/model/Interest.js';
import UserInterest from '../interests/model/UserInterest.js';
import { interestSelectionSchema } from '../interests/validation/interestSchemas.js';
import Education from '../profiles/model/Education.js';
import Profile from '../profiles/model/Profile.js';
import ProfessionalExperience from '../profiles/model/ProfessionalExperience.js';
import { educationSchema, experienceSchema } from '../profiles/validation/historySchemas.js';
import { basicProfileSchema, professionalStatusSchema } from '../profiles/validation/profileSchemas.js';
import Skill from '../skills/model/Skill.js';
import UserSkill from '../skills/model/UserSkill.js';
import { skillSelectionSchema } from '../skills/validation/skillSchemas.js';
import User from '../users/model/User.js';
import { onboardingProgressSchema } from './validation/onboardingSchemas.js';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([
    User.init(),
    Profile.init(),
    Skill.init(),
    Interest.init(),
    UserSkill.init(),
    UserInterest.init()
  ]);
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

describe('Phase 01 persistence foundation', () => {
  it('keeps a legacy account and its session usable without backfilling fields', async () => {
    const email = 'legacy@example.test';
    const inserted = await mongoose.connection.db!.collection('users').insertOne({
      name: 'Legacy User',
      email,
      passwordHash: await hashPassword('legacy-password-123')
    });

    const existingToken = 'ab'.repeat(32);
    await mongoose.connection.db!.collection('sessions').insertOne({
      userId: inserted.insertedId,
      tokenHash: createHash('sha256').update(existingToken).digest('hex'),
      expiresAt: new Date(Date.now() + 60_000)
    });
    const existingSession = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', `voklance_session=${existingToken}`);
    expect(existingSession.status).toBe(200);
    expect(existingSession.body.data.user.email).toBe(email);
    expect(existingSession.body.data.user).toMatchObject({
      accountStatus: 'ACTIVE',
      onboardingStatus: 'NOT_STARTED'
    });
    const rawLegacy = await mongoose.connection.db!.collection('users').findOne({ _id: inserted.insertedId });
    expect(rawLegacy).not.toHaveProperty('onboardingStatus');
    const onboarding = await request(app)
      .get('/api/v1/onboarding')
      .set('Cookie', `voklance_session=${existingToken}`);
    expect(onboarding.body.data.onboarding).toMatchObject({ status: 'NOT_STARTED', currentStep: 1 });

    const agent = request.agent(app);
    const login = await agent.post('/api/v1/auth/login').send({ email, password: 'legacy-password-123' });
    expect(login.status).toBe(200);
    expect(login.body.data.user).toMatchObject({ name: 'Legacy User', email });
    expect((await agent.get('/api/v1/auth/me')).status).toBe(200);
    expect((await agent.post('/api/v1/auth/logout')).status).toBe(200);
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
  });

  it('defaults onboarding fields for new users without changing existing account fields', async () => {
    const user = new User({ name: 'New User', email: 'new@example.test', passwordHash: 'stored-hash' });
    await user.validate();
    expect(user.accountStatus).toBe('ACTIVE');
    expect(user.onboardingStatus).toBe('NOT_STARTED');
    expect(user.onboardingStep).toBe(1);
    expect(user.emailVerifiedAt).toBeUndefined();
    user.onboardingStep = 7 as 1;
    await expect(user.validate()).rejects.toThrow();
  });

  it('persists a resumable onboarding step on the existing user record', async () => {
    const user = await User.create({
      name: 'Progress User',
      email: 'progress@example.test',
      passwordHash: 'stored-hash',
      onboardingStatus: 'IN_PROGRESS',
      onboardingStep: 4
    });
    const reloaded = await User.findById(user._id);
    expect(reloaded?.onboardingStatus).toBe('IN_PROGRESS');
    expect(reloaded?.onboardingStep).toBe(4);
    expect(reloaded?.onboardingCompletedAt).toBeUndefined();
  });

  it('normalizes usernames and enforces one profile and username per user', async () => {
    const firstUserId = new mongoose.Types.ObjectId();
    const profile = await Profile.create({
      userId: firstUserId,
      username: '  Ada.Dev  ',
      fullName: 'Ada Dev',
      headline: 'Software engineer',
      country: 'India'
    });
    expect(profile.username).toBe('ada.dev');
    await expect(
      Profile.create({
        userId: new mongoose.Types.ObjectId(),
        username: 'ADA.DEV',
        fullName: 'Another User',
        headline: 'Software engineer',
        country: 'India'
      })
    ).rejects.toMatchObject({ code: 11000 });
    await expect(
      Profile.create({
        userId: firstUserId,
        username: 'another-user',
        fullName: 'Ada Dev',
        headline: 'Software engineer',
        country: 'India'
      })
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('seeds catalogs idempotently and blocks duplicate selections', async () => {
    await Skill.bulkWrite(catalogUpserts(skillSeeds));
    await Interest.bulkWrite(catalogUpserts(interestSeeds));
    await Skill.bulkWrite(catalogUpserts(skillSeeds));
    await Interest.bulkWrite(catalogUpserts(interestSeeds));
    expect(await Skill.countDocuments()).toBe(skillSeeds.length);
    expect(await Interest.countDocuments()).toBe(interestSeeds.length);

    const userId = new mongoose.Types.ObjectId();
    const skillId = (await Skill.findOne({ slug: 'typescript' }))!._id;
    const interestId = (await Interest.findOne({ slug: 'frontend-development' }))!._id;
    await UserSkill.create({ userId, skillId });
    await UserInterest.create({ userId, interestId });
    await expect(UserSkill.create({ userId, skillId })).rejects.toMatchObject({ code: 11000 });
    await expect(UserInterest.create({ userId, interestId })).rejects.toMatchObject({ code: 11000 });
  });

  it('validates experience and education dates while allowing no experience records', async () => {
    const userId = new mongoose.Types.ObjectId();
    expect(await ProfessionalExperience.countDocuments({ userId })).toBe(0);
    await expect(
      new ProfessionalExperience({
        userId,
        jobTitle: 'Engineer',
        companyName: 'Example Co',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2023-01-01'),
        isCurrent: false
      }).validate()
    ).rejects.toThrow();
    await expect(
      new ProfessionalExperience({
        userId,
        jobTitle: 'Engineer',
        companyName: 'Example Co',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2025-01-01'),
        isCurrent: true
      }).validate()
    ).rejects.toThrow();
    await expect(
      new Education({
        userId,
        institution: 'Example University',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2023-01-01')
      }).validate()
    ).rejects.toThrow();
  });

  it('rejects browser-supplied ownership and invalid progress or selections', () => {
    expect(
      basicProfileSchema.parse({
        username: '  Ada.Dev  ',
        fullName: 'Ada Dev',
        headline: 'Engineer',
        country: 'India'
      }).username
    ).toBe('ada.dev');
    expect(
      basicProfileSchema.safeParse({
        userId: new mongoose.Types.ObjectId().toString(),
        username: 'ada.dev',
        fullName: 'Ada Dev',
        headline: 'Engineer',
        country: 'India'
      }).success
    ).toBe(false);
    expect(professionalStatusSchema.safeParse('STUDENT').success).toBe(true);
    expect(onboardingProgressSchema.safeParse({ currentStep: 7 }).success).toBe(false);
    const id = new mongoose.Types.ObjectId().toString();
    expect(skillSelectionSchema.safeParse({ skillIds: [id, id] }).success).toBe(false);
    expect(interestSelectionSchema.safeParse({ interestIds: [id, id] }).success).toBe(false);
    expect(
      experienceSchema.safeParse({
        jobTitle: 'Engineer',
        companyName: 'Example Co',
        startDate: '2024-01-01',
        endDate: '2025-01-01',
        isCurrent: true
      }).success
    ).toBe(false);
    expect(
      educationSchema.safeParse({
        institution: 'Example University',
        startDate: '2024-01-01',
        endDate: '2023-01-01'
      }).success
    ).toBe(false);
  });
});
