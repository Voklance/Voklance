import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../app.js';
import User from '../users/model/User.js';
import Profile from './model/Profile.js';
import ProfileCertification from './model/ProfileCertification.js';
import ProfileProject from './model/ProfileProject.js';
import ProfileUsernameAlias from './model/ProfileUsernameAlias.js';

let mongo: MongoMemoryServer;
let owner = '';
let other = '';
let certId = '';
let projectId = '';
async function account(name: string, email: string, username: string) {
  const response = await request(app)
    .post('/api/v1/auth/signup')
    .send({ name, email, password: 'password-123' });
  expect(response.status).toBe(201);
  const userId = response.body.data.user.id;
  await User.updateOne({ _id: userId }, { $set: { onboardingStatus: 'COMPLETED' } });
  await Profile.create({
    userId,
    username,
    fullName: name,
    headline: 'Engineer',
    country: 'India',
    visibility: 'PRIVATE'
  });
  return String(response.headers['set-cookie']?.[0]).split(';')[0];
}
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([
    User.init(),
    Profile.init(),
    ProfileCertification.init(),
    ProfileProject.init(),
    ProfileUsernameAlias.init()
  ]);
  owner = await account('Portfolio Owner', 'portfolio-owner@example.test', 'portfolio-owner');
  other = await account('Other Person', 'portfolio-other@example.test', 'other-person');
}, 120_000);
afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

describe('profile portfolio', () => {
  it('validates secure links and ownership for certifications', async () => {
    const body = {
      name: 'Cloud Developer',
      issuingOrganization: 'Example Org',
      issueDate: '2024-05-01',
      credentialUrl: 'https://example.test/credential'
    };
    expect((await request(app).post('/api/v1/me/profile/certifications').send(body)).status).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/v1/me/profile/certifications')
          .set('Cookie', owner)
          .send({ ...body, credentialUrl: 'javascript:alert(1)' })
      ).status
    ).toBe(400);
    const created = await request(app)
      .post('/api/v1/me/profile/certifications')
      .set('Cookie', owner)
      .send(body);
    expect(created.status).toBe(201);
    certId = created.body.data.item.id;
    expect(
      (
        await request(app)
          .patch(`/api/v1/me/profile/certifications/${certId}`)
          .set('Cookie', owner)
          .send({ expirationDate: '2020-01-01' })
      ).status
    ).toBe(400);
    expect(
      (await request(app).get('/api/v1/me/profile/certifications').set('Cookie', other)).body.data.items
    ).toEqual([]);
    expect(
      (
        await request(app)
          .patch(`/api/v1/me/profile/certifications/${certId}`)
          .set('Cookie', other)
          .send({ name: 'Stolen' })
      ).status
    ).toBe(404);
  });
  it('validates project dates, features projects, and protects ownership', async () => {
    const body = {
      title: 'Developer tool',
      description: 'A useful developer project',
      role: 'Maintainer',
      technologies: ['TypeScript'],
      projectUrl: 'https://example.test/project',
      isFeatured: true
    };
    expect(
      (
        await request(app)
          .post('/api/v1/me/profile/projects')
          .set('Cookie', owner)
          .send({ ...body, startDate: '2025-01-01', endDate: '2024-01-01' })
      ).status
    ).toBe(400);
    const created = await request(app).post('/api/v1/me/profile/projects').set('Cookie', owner).send(body);
    expect(created.status).toBe(201);
    projectId = created.body.data.item.id;
    expect(
      (
        await request(app)
          .patch(`/api/v1/me/profile/projects/${projectId}`)
          .set('Cookie', owner)
          .send({ endDate: '2024-01-01' })
      ).status
    ).toBe(400);
    expect(created.body.data.item.isFeatured).toBe(true);
    const updated = await request(app)
      .patch(`/api/v1/me/profile/projects/${projectId}`)
      .set('Cookie', owner)
      .send({ isFeatured: false });
    expect(updated.status).toBe(200);
    expect(updated.body.data.item.title).toBe('Developer tool');
    expect(updated.body.data.item.role).toBe('Maintainer');
    expect(updated.body.data.item.isFeatured).toBe(false);
    expect(
      (
        await request(app)
          .patch(`/api/v1/me/profile/projects/${projectId}`)
          .set('Cookie', owner)
          .send({ isFeatured: true })
      ).status
    ).toBe(200);
    expect(
      (await request(app).delete(`/api/v1/me/profile/projects/${projectId}`).set('Cookie', other)).status
    ).toBe(404);
  });
  it('returns completeness privately and sections only on public profiles', async () => {
    const result = await request(app).get('/api/v1/me/profile/completeness').set('Cookie', owner);
    expect(result.status).toBe(200);
    expect(result.body.data.percentage).toBeGreaterThan(0);
    expect((await request(app).get('/api/v1/profiles/public/portfolio-owner')).status).toBe(404);
    const publish = await request(app)
      .patch('/api/v1/profiles/me')
      .set('Cookie', owner)
      .send({
        visibility: 'PUBLIC',
        sectionOrder: [
          'about',
          'projects',
          'experience',
          'education',
          'skills',
          'certifications',
          'github',
          'links'
        ]
      });
    expect(publish.status).toBe(200);
    const publicResult = await request(app).get('/api/v1/profiles/public/portfolio-owner');
    expect(publicResult.status).toBe(200);
    expect(publicResult.body.data.certifications).toHaveLength(1);
    expect(publicResult.body.data.projects).toMatchObject([{ id: projectId, isFeatured: true }]);
    expect(publicResult.body.data.profile.sectionOrder[1]).toBe('projects');
    expect(JSON.stringify(publicResult.body.data)).not.toContain('portfolio-owner@example.test');
    const search = await request(app).get('/api/v1/search?q=Developer&category=people').set('Cookie', other);
    expect(search.status).toBe(200);
    expect(search.body.data.items.map((item: { href: string }) => item.href)).toContain(
      '/app/professionals/portfolio-owner'
    );
    const exported = await request(app)
      .post('/api/v1/settings/data/export')
      .set('Cookie', owner)
      .send({ currentPassword: 'password-123' });
    expect(exported.status).toBe(200);
    expect(exported.body.certifications).toHaveLength(1);
    expect(exported.body.projects).toHaveLength(1);
  });
  it('keeps shared profile URLs working after a username change', async () => {
    const changed = await request(app)
      .patch('/api/v1/profiles/me')
      .set('Cookie', owner)
      .send({ username: 'portfolio-owner-new' });
    expect(changed.status).toBe(200);
    const oldLink = await request(app).get('/api/v1/profiles/public/portfolio-owner');
    expect(oldLink.status).toBe(200);
    expect(oldLink.body.data.profile.username).toBe('portfolio-owner-new');
    const claimed = await request(app)
      .patch('/api/v1/profiles/me')
      .set('Cookie', other)
      .send({ username: 'portfolio-owner' });
    expect(claimed.status).toBe(409);
  });
});
