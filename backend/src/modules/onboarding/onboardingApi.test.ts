import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../app.js';
import { catalogUpserts, interestSeeds, skillSeeds } from '../../database/catalogSeeds.js';
import Interest from '../interests/model/Interest.js';
import UserInterest from '../interests/model/UserInterest.js';
import Education from '../profiles/model/Education.js';
import Profile from '../profiles/model/Profile.js';
import ProfessionalExperience from '../profiles/model/ProfessionalExperience.js';
import Skill from '../skills/model/Skill.js';
import UserSkill from '../skills/model/UserSkill.js';
import User from '../users/model/User.js';

let mongo: MongoMemoryServer;
let first: ReturnType<typeof request.agent>;
let second: ReturnType<typeof request.agent>;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([
    User.init(),
    Profile.init(),
    Skill.init(),
    UserSkill.init(),
    Interest.init(),
    UserInterest.init(),
    ProfessionalExperience.init(),
    Education.init()
  ]);
  await Skill.bulkWrite(catalogUpserts(skillSeeds));
  await Interest.bulkWrite(catalogUpserts(interestSeeds));

  first = request.agent(app);
  second = request.agent(app);
  for (const [agent, email] of [
    [first, 'first@example.test'],
    [second, 'second@example.test']
  ] as const) {
    const response = await agent
      .post('/api/v1/auth/signup')
      .send({ name: 'Test User', email, password: 'test-password-123' });
    if (response.status !== 201) throw new Error(`Could not create test account: ${response.status}`);
    await User.updateOne({ _id: response.body.data.user.id }, { $set: { emailVerifiedAt: new Date() } });
  }
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

describe('onboarding route protection', () => {
  it.each([
    '/api/v1/profiles/me',
    '/api/v1/profiles/check-username?username=ada',
    '/api/v1/skills',
    '/api/v1/users/me/skills',
    '/api/v1/interests',
    '/api/v1/users/me/interests',
    '/api/v1/users/me/experiences',
    '/api/v1/users/me/educations',
    '/api/v1/onboarding'
  ])('rejects an unauthenticated GET %s', async (path) => {
    expect((await request(app).get(path)).status).toBe(401);
  });
});

describe('protected profile API', () => {
  it('requires a valid existing session', async () => {
    expect((await request(app).get('/api/v1/profiles/me')).status).toBe(401);
    const invalid = await request(app)
      .get('/api/v1/profiles/me')
      .set('Cookie', `voklance_session=${'ab'.repeat(32)}`);
    expect(invalid.status).toBe(401);
    expect((await first.get('/api/v1/profiles/me')).body.data.profile).toBeNull();
  });

  it('creates and partially updates only the signed-in user profile', async () => {
    const incomplete = await first.patch('/api/v1/profiles/me').send({ username: 'first-user' });
    expect(incomplete.status).toBe(400);

    const created = await first.patch('/api/v1/profiles/me').send({
      username: 'First.User',
      fullName: 'First User',
      headline: 'Software engineer',
      country: 'India'
    });
    expect(created.status).toBe(200);
    expect(created.body.data.profile).toMatchObject({ username: 'first.user', fullName: 'First User' });
    expect(created.body.data.profile).not.toHaveProperty('userId');

    const updated = await first.patch('/api/v1/profiles/me').send({ bio: 'Building software' });
    expect(updated.body.data.profile).toMatchObject({
      username: 'first.user',
      headline: 'Software engineer',
      bio: 'Building software'
    });
    expect((await second.get('/api/v1/profiles/me')).body.data.profile).toBeNull();
    expect(await Profile.countDocuments()).toBe(1);
  });

  it('normalizes availability checks and handles duplicate usernames', async () => {
    const own = await first.get('/api/v1/profiles/check-username?username=FIRST.USER');
    expect(own.body.data).toEqual({ username: 'first.user', available: true });
    const other = await second.get('/api/v1/profiles/check-username?username=first.user');
    expect(other.body.data.available).toBe(false);
    expect((await second.get('/api/v1/profiles/check-username?username=bad%20name')).status).toBe(400);

    const duplicate = await second.patch('/api/v1/profiles/me').send({
      username: 'first.user',
      fullName: 'Second User',
      headline: 'Engineer',
      country: 'India'
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('USERNAME_TAKEN');
    expect(
      (await second.patch('/api/v1/profiles/me').send({ userId: new mongoose.Types.ObjectId() })).status
    ).toBe(400);
  });
});

describe('skills API', () => {
  it('lists a bounded, searchable catalog', async () => {
    const response = await first.get('/api/v1/skills?search=react&limit=2');
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ page: 1, limit: 2, total: 1 });
    expect(response.body.data.items[0].slug).toBe('react-js');
    expect((await first.get('/api/v1/skills?limit=1000')).status).toBe(400);
    expect((await first.get('/api/v1/skills?category=Cloud')).body.data.items[0].slug).toBe('aws');
  });

  it('replaces skill selections idempotently and validates references', async () => {
    const skill = await Skill.findOne({ slug: 'typescript' });
    const id = skill!._id.toString();
    expect((await first.put('/api/v1/users/me/skills').send({ skillIds: ['invalid'] })).status).toBe(400);
    expect((await first.put('/api/v1/users/me/skills').send({ skillIds: [id, id] })).status).toBe(400);
    expect(
      (
        await first
          .put('/api/v1/users/me/skills')
          .send({ skillIds: [new mongoose.Types.ObjectId().toString()] })
      ).body.error.code
    ).toBe('UNKNOWN_SKILL');

    const saved = await first.put('/api/v1/users/me/skills').send({ skillIds: [id] });
    expect(saved.status).toBe(200);
    expect(saved.body.data.skills.map((item: { id: string }) => item.id)).toEqual([id]);
    expect((await first.put('/api/v1/users/me/skills').send({ skillIds: [id] })).status).toBe(200);
    const replacementId = (await Skill.findOne({ slug: 'react-js' }))!._id.toString();
    expect((await first.put('/api/v1/users/me/skills').send({ skillIds: [replacementId] })).status).toBe(200);
    expect((await first.get('/api/v1/users/me/skills')).body.data.skills[0].id).toBe(replacementId);
    expect((await first.put('/api/v1/users/me/skills').send({ skillIds: [id] })).status).toBe(200);
    expect(await UserSkill.countDocuments()).toBe(1);
    expect(
      (await first.put('/api/v1/users/me/skills').send({ skillIds: [id], userId: 'other' })).status
    ).toBe(400);
    expect((await second.get('/api/v1/users/me/skills')).body.data.skills).toEqual([]);
  });
});

describe('interests API', () => {
  it('lists searchable interests and validates pagination', async () => {
    const response = await first.get('/api/v1/interests?search=cloud&limit=10');
    expect(response.status).toBe(200);
    expect(response.body.data.items.map((item: { slug: string }) => item.slug)).toEqual(['cloud-computing']);
    expect((await first.get('/api/v1/interests?page=0')).status).toBe(400);
  });

  it('replaces only the current user interests', async () => {
    const id = (await Interest.findOne({ slug: 'career-opportunities' }))!._id.toString();
    expect((await first.put('/api/v1/users/me/interests').send({ interestIds: ['bad'] })).status).toBe(400);
    expect((await first.put('/api/v1/users/me/interests').send({ interestIds: [id, id] })).status).toBe(400);
    expect(
      (
        await first
          .put('/api/v1/users/me/interests')
          .send({ interestIds: [new mongoose.Types.ObjectId().toString()] })
      ).body.error.code
    ).toBe('UNKNOWN_INTEREST');
    const saved = await first.put('/api/v1/users/me/interests').send({ interestIds: [id] });
    expect(saved.status).toBe(200);
    expect(saved.body.data.interests.map((item: { id: string }) => item.id)).toEqual([id]);
    expect((await first.put('/api/v1/users/me/interests').send({ interestIds: [id] })).status).toBe(200);
    const replacementId = (await Interest.findOne({ slug: 'cloud-computing' }))!._id.toString();
    expect(
      (await first.put('/api/v1/users/me/interests').send({ interestIds: [replacementId] })).status
    ).toBe(200);
    expect((await first.get('/api/v1/users/me/interests')).body.data.interests[0].id).toBe(replacementId);
    expect((await first.put('/api/v1/users/me/interests').send({ interestIds: [id] })).status).toBe(200);
    expect(await UserInterest.countDocuments()).toBe(1);
    expect((await second.get('/api/v1/users/me/interests')).body.data.interests).toEqual([]);
  });
});

describe('experience API', () => {
  it('creates, lists, updates, and deletes only owned records', async () => {
    const created = await first.post('/api/v1/users/me/experiences').send({
      jobTitle: 'Frontend Developer',
      companyName: 'Example Technologies',
      employmentType: 'FULL_TIME',
      startDate: '2024-04-01',
      endDate: null,
      isCurrent: true
    });
    expect(created.status).toBe(201);
    const id = created.body.data.experience.id;
    expect(created.body.data.experience).not.toHaveProperty('userId');
    expect((await first.get('/api/v1/users/me/experiences')).body.data.experiences).toHaveLength(1);
    expect((await second.get('/api/v1/users/me/experiences')).body.data.experiences).toEqual([]);
    expect(
      (await second.patch(`/api/v1/users/me/experiences/${id}`).send({ jobTitle: 'Changed' })).status
    ).toBe(404);
    expect((await second.delete(`/api/v1/users/me/experiences/${id}`)).status).toBe(404);
    expect((await first.patch('/api/v1/users/me/experiences/bad').send({ jobTitle: 'Changed' })).status).toBe(
      400
    );
    const updated = await first.patch(`/api/v1/users/me/experiences/${id}`).send({
      isCurrent: false,
      endDate: '2025-01-01'
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data.experience.endDate).toBe('2025-01-01');
    expect((await first.delete(`/api/v1/users/me/experiences/${id}`)).status).toBe(200);
    expect((await first.get('/api/v1/users/me/experiences')).body.data.experiences).toEqual([]);
  });

  it('rejects invalid dates and client-supplied ownership', async () => {
    const invalid = await first.post('/api/v1/users/me/experiences').send({
      jobTitle: 'Engineer',
      companyName: 'Example Co',
      startDate: '2025-01-01',
      endDate: '2024-01-01',
      isCurrent: false
    });
    expect(invalid.status).toBe(400);
    expect(
      (
        await first.post('/api/v1/users/me/experiences').send({
          userId: new mongoose.Types.ObjectId().toString(),
          jobTitle: 'Engineer',
          companyName: 'Example Co',
          startDate: '2024-01-01',
          isCurrent: true
        })
      ).status
    ).toBe(400);
  });
});

describe('education API', () => {
  it('creates, lists, updates, and deletes only owned records', async () => {
    const created = await first.post('/api/v1/users/me/educations').send({
      institution: 'Example University',
      degree: 'Bachelor of Technology',
      fieldOfStudy: 'Computer Science',
      startDate: '2020-08-01',
      endDate: '2024-05-01'
    });
    expect(created.status).toBe(201);
    const id = created.body.data.education.id;
    expect((await first.get('/api/v1/users/me/educations')).body.data.educations).toHaveLength(1);
    expect((await second.get('/api/v1/users/me/educations')).body.data.educations).toEqual([]);
    expect((await second.patch(`/api/v1/users/me/educations/${id}`).send({ degree: 'Changed' })).status).toBe(
      404
    );
    expect((await second.delete(`/api/v1/users/me/educations/${id}`)).status).toBe(404);
    const updated = await first.patch(`/api/v1/users/me/educations/${id}`).send({ degree: 'B.Tech' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.education.fieldOfStudy).toBe('Computer Science');
    expect((await first.delete(`/api/v1/users/me/educations/${id}`)).status).toBe(200);
  });

  it('rejects invalid education date ranges', async () => {
    const invalid = await first.post('/api/v1/users/me/educations').send({
      institution: 'Example University',
      startDate: '2025-01-01',
      endDate: '2024-01-01'
    });
    expect(invalid.status).toBe(400);
  });
});

describe('onboarding API', () => {
  it('returns initial state and persists validated, resumable progress', async () => {
    expect((await request(app).get('/api/v1/onboarding')).status).toBe(401);
    const initial = await second.get('/api/v1/onboarding');
    expect(initial.status).toBe(200);
    expect(initial.body.data.onboarding).toMatchObject({
      status: 'NOT_STARTED',
      currentStep: 1,
      completedSteps: [],
      profile: null,
      skills: [],
      interests: []
    });
    expect((await second.patch('/api/v1/onboarding').send({ currentStep: 7 })).status).toBe(400);
    expect((await second.patch('/api/v1/onboarding').send({ currentStep: 6 })).status).toBe(409);
    const saved = await second.patch('/api/v1/onboarding').send({ currentStep: 1 });
    expect(saved.body.data.onboarding.status).toBe('IN_PROGRESS');
    expect((await second.get('/api/v1/onboarding')).body.data.onboarding.currentStep).toBe(1);
    expect((await second.post('/api/v1/onboarding/complete').send({ userId: 'someone-else' })).status).toBe(
      400
    );
    expect((await second.post('/api/v1/onboarding/complete')).body.error.code).toBe('ONBOARDING_INCOMPLETE');
  });

  it('derives completion from persisted data and completes only the current user once', async () => {
    expect((await first.post('/api/v1/onboarding/complete')).body.error.code).toBe('ONBOARDING_INCOMPLETE');
    expect((await first.patch('/api/v1/onboarding').send({ currentStep: 6 })).status).toBe(409);
    const status = await first.patch('/api/v1/profiles/me').send({ professionalStatus: 'STUDENT' });
    expect(status.status).toBe(200);

    const saved = await first.patch('/api/v1/onboarding').send({ currentStep: 6 });
    expect(saved.status).toBe(200);
    expect(saved.body.data.onboarding.completedSteps).toEqual([1, 2, 3, 4, 5]);
    const complete = await first.post('/api/v1/onboarding/complete');
    expect(complete.status).toBe(200);
    expect(complete.body.data.onboarding.status).toBe('COMPLETED');
    expect((await first.get('/api/v1/auth/me')).body.data.user.onboardingStatus).toBe('COMPLETED');
    expect(complete.body.data.onboarding.currentStep).toBe(6);
    const completedAt = complete.body.data.onboarding.completedAt;
    expect(completedAt).toEqual(expect.any(String));
    expect((await first.post('/api/v1/onboarding/complete')).body.data.onboarding.completedAt).toBe(
      completedAt
    );
    expect(
      (await first.patch('/api/v1/onboarding').send({ currentStep: 2 })).body.data.onboarding.status
    ).toBe('COMPLETED');
    expect((await second.get('/api/v1/onboarding')).body.data.onboarding.status).toBe('IN_PROGRESS');
    expect((await User.findOne({ email: 'first@example.test' }))?.onboardingStatus).toBe('COMPLETED');
    expect((await first.put('/api/v1/users/me/skills').send({ skillIds: [] })).status).toBe(409);
    expect((await first.put('/api/v1/users/me/interests').send({ interestIds: [] })).status).toBe(409);
  });
});
