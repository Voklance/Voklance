import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import app from '../../app.js';
import User from '../users/model/User.js';
import Profile from '../profiles/model/Profile.js';
import Community from './model/Community.js';
import CommunityMembership from '../memberships/model/CommunityMembership.js';

let mongo: MongoMemoryServer;
let owner = { id: '', cookie: '' };
let member = { id: '', cookie: '' };
let outsider = { id: '', cookie: '' };
let publicId = '';
let privateId = '';
let privateSlug = '';
const body = (name: string, visibility: 'PUBLIC' | 'PRIVATE' = 'PUBLIC') => ({
  name,
  description: `Professional discussion for ${name}.`,
  category: 'software-development',
  tags: ['react', 'typescript'],
  visibility,
  rules: 'Be respectful and stay on topic.'
});
async function signup(name: string, number: number) {
  const response = await request(app)
    .post('/api/v1/auth/signup')
    .send({
      name,
      email: `community-${number}@example.test`,
      password: 'password-123'
    });
  expect(response.status).toBe(201);
  const id = response.body.data.user.id as string;
  await User.updateOne({ _id: id }, { $set: { onboardingStatus: 'COMPLETED' } });
  return { id, cookie: String(response.headers['set-cookie']?.[0]).split(';')[0] };
}
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), Profile.init(), Community.init(), CommunityMembership.init()]);
  owner = await signup('Community Owner', 1);
  member = await signup('Community Member', 2);
  outsider = await signup('Community Outsider', 3);
  await Profile.create({
    userId: owner.id,
    username: 'community-owner',
    fullName: 'Community Owner',
    headline: 'Engineer',
    country: 'India',
    visibility: 'PUBLIC'
  });
  await Profile.create({
    userId: member.id,
    username: 'community-member',
    fullName: 'Community Member',
    headline: 'Designer',
    country: 'India',
    visibility: 'PUBLIC'
  });
}, 120_000);
afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

describe('community API on standalone MongoDB', () => {
  it('requires auth and completed onboarding for creation and rolls back failed owner membership', async () => {
    expect((await request(app).post('/api/v1/communities').send(body('No Session'))).status).toBe(401);
    const incomplete = await request(app)
      .post('/api/v1/auth/signup')
      .send({ name: 'Incomplete', email: 'incomplete-community@example.test', password: 'password-123' });
    const cookie = String(incomplete.headers['set-cookie']?.[0]).split(';')[0];
    expect(
      (await request(app).post('/api/v1/communities').set('Cookie', cookie).send(body('Not Ready'))).body
        .error.code
    ).toBe('ONBOARDING_REQUIRED');
    expect(
      (
        await request(app)
          .post('/api/v1/communities')
          .set('Cookie', owner.cookie)
          .send({ ...body('Bad Fields'), ownerId: outsider.id })
      ).status
    ).toBe(400);
    const create = vi.spyOn(CommunityMembership, 'create').mockRejectedValueOnce(new Error('write failed'));
    expect(
      (await request(app).post('/api/v1/communities').set('Cookie', owner.cookie).send(body('Rollback Test')))
        .status
    ).toBe(500);
    create.mockRestore();
    expect(await Community.countDocuments({ name: 'Rollback Test' })).toBe(0);
  });

  it('creates an owner membership, unique slugs, discovery, search, filters and pagination', async () => {
    const created = await request(app)
      .post('/api/v1/communities')
      .set('Cookie', owner.cookie)
      .send(body('React Professionals'));
    expect(created.status).toBe(201);
    publicId = created.body.data.community.id;
    expect(created.body.data.community).toMatchObject({
      slug: 'react-professionals',
      myRole: 'OWNER',
      memberCount: 1
    });
    const duplicate = await request(app)
      .post('/api/v1/communities')
      .set('Cookie', owner.cookie)
      .send(body('React Professionals'));
    expect(duplicate.status).toBe(201);
    expect(duplicate.body.data.community.slug).not.toBe('react-professionals');
    const anonymous = await request(app).get(
      '/api/v1/communities?search=React&category=software-development&limit=1'
    );
    expect(anonymous.status).toBe(200);
    expect(anonymous.body.data.items).toHaveLength(1);
    expect(anonymous.body.data.hasMore).toBe(true);
    const second = await request(app)
      .get('/api/v1/communities')
      .query({ limit: 1, cursor: anonymous.body.data.nextCursor });
    expect(second.body.data.items[0].id).not.toBe(anonymous.body.data.items[0].id);
    expect((await request(app).get('/api/v1/communities?cursor=bad')).status).toBe(400);
    expect((await request(app).get('/api/v1/communities?category=invalid')).status).toBe(400);
    expect((await CommunityMembership.findOne({ communityId: publicId, userId: owner.id }))?.role).toBe(
      'OWNER'
    );
  });

  it('joins public communities once, lists safe members, and protects owner and roles', async () => {
    const join = `/api/v1/communities/${publicId}/join`;
    expect((await request(app).post(join).set('Cookie', member.cookie)).body.data.membershipStatus).toBe(
      'ACTIVE'
    );
    expect((await request(app).post(join).set('Cookie', member.cookie)).body.data.membershipStatus).toBe(
      'ACTIVE'
    );
    const detail = await request(app)
      .get('/api/v1/communities/react-professionals')
      .set('Cookie', member.cookie);
    expect(detail.body.data.community.memberCount).toBe(2);
    expect(detail.body.data.community.permissions.viewMembers).toBe(true);
    expect(
      (await request(app).delete(`/api/v1/communities/${publicId}/membership`).set('Cookie', owner.cookie))
        .body.error.code
    ).toBe('OWNER_TRANSFER_REQUIRED');
    expect(
      (await request(app).get(`/api/v1/communities/${publicId}/members`).set('Cookie', outsider.cookie))
        .status
    ).toBe(403);
    const directory = await request(app)
      .get(`/api/v1/communities/${publicId}/members`)
      .set('Cookie', member.cookie);
    expect(directory.body.data.items).toHaveLength(2);
    expect(directory.body.data.items[0]).not.toHaveProperty('email');
    expect(
      (
        await request(app)
          .patch(`/api/v1/communities/${publicId}/members/${owner.id}/role`)
          .set('Cookie', member.cookie)
          .send({ role: 'ADMIN' })
      ).status
    ).toBe(403);
    expect(
      (
        await request(app)
          .patch(`/api/v1/communities/${publicId}/members/${member.id}/role`)
          .set('Cookie', owner.cookie)
          .send({ role: 'ADMIN' })
      ).body.data.role
    ).toBe('ADMIN');
    expect(
      (
        await request(app)
          .patch(`/api/v1/communities/${publicId}/members/${owner.id}/role`)
          .set('Cookie', member.cookie)
          .send({ role: 'MEMBER' })
      ).status
    ).toBe(403);
    expect(
      (
        await request(app)
          .patch(`/api/v1/communities/${publicId}/members/${member.id}/role`)
          .set('Cookie', owner.cookie)
          .send({ role: 'MEMBER' })
      ).status
    ).toBe(200);
    expect(
      (await request(app).delete(`/api/v1/communities/${publicId}/membership`).set('Cookie', member.cookie))
        .body.data.membershipStatus
    ).toBe('REMOVED');
    expect(
      (await request(app).get('/api/v1/users/me/communities').set('Cookie', member.cookie)).body.data.items
    ).toHaveLength(0);
  });

  it('keeps private details and requests restricted, then approves and rejects safely', async () => {
    const created = await request(app)
      .post('/api/v1/communities')
      .set('Cookie', owner.cookie)
      .send(body('Private React Guild', 'PRIVATE'));
    privateId = created.body.data.community.id;
    privateSlug = created.body.data.community.slug;
    expect(
      (await request(app).get('/api/v1/communities?search=typescript')).body.data.items.map(
        (item: { id: string }) => item.id
      )
    ).not.toContain(privateId);
    const anonymous = await request(app).get(`/api/v1/communities/${privateSlug}`);
    expect(anonymous.body.data.community).toMatchObject({
      description: null,
      rules: null,
      owner: null,
      tags: []
    });
    const pending = await request(app)
      .post(`/api/v1/communities/${privateId}/join`)
      .set('Cookie', member.cookie);
    expect(pending.body.data.membershipStatus).toBe('PENDING');
    expect(
      (await request(app).post(`/api/v1/communities/${privateId}/join`).set('Cookie', member.cookie)).body
        .data.membershipStatus
    ).toBe('PENDING');
    expect(
      (await request(app).get(`/api/v1/communities/${privateId}/members`).set('Cookie', member.cookie)).status
    ).toBe(403);
    const list = await request(app)
      .get(`/api/v1/communities/${privateId}/membership-requests`)
      .set('Cookie', owner.cookie);
    expect(list.body.data.items).toHaveLength(1);
    expect(list.body.data.items[0].member).not.toHaveProperty('email');
    const requestId = list.body.data.items[0].id;
    expect(
      (
        await request(app)
          .post(`/api/v1/communities/${privateId}/membership-requests/${requestId}/approve`)
          .set('Cookie', outsider.cookie)
      ).status
    ).toBe(403);
    expect(
      (
        await request(app)
          .post(`/api/v1/communities/${privateId}/membership-requests/${requestId}/approve`)
          .set('Cookie', owner.cookie)
      ).body.data.membershipStatus
    ).toBe('ACTIVE');
    expect(
      (
        await request(app)
          .post(`/api/v1/communities/${privateId}/membership-requests/${requestId}/approve`)
          .set('Cookie', owner.cookie)
      ).status
    ).toBe(409);
    expect(
      (await request(app).get(`/api/v1/communities/${privateSlug}`).set('Cookie', member.cookie)).body.data
        .community.rules
    ).toBe('Be respectful and stay on topic.');
    expect(
      (await request(app).get('/api/v1/users/me/communities').set('Cookie', member.cookie)).body.data.items
    ).toHaveLength(1);
    const secondRequest = await request(app)
      .post(`/api/v1/communities/${privateId}/join`)
      .set('Cookie', outsider.cookie);
    expect(secondRequest.body.data.membershipStatus).toBe('PENDING');
    const outsiderRequest = await CommunityMembership.findOne({
      communityId: privateId,
      userId: outsider.id
    });
    expect(
      (
        await request(app)
          .post(`/api/v1/communities/${privateId}/membership-requests/${outsiderRequest?.id}/reject`)
          .set('Cookie', owner.cookie)
      ).body.data.membershipStatus
    ).toBe('REJECTED');
    expect(
      (await request(app).get(`/api/v1/communities/${privateSlug}`).set('Cookie', outsider.cookie)).body.data
        .community.rules
    ).toBeNull();
    await request(app).post(`/api/v1/communities/${privateId}/join`).set('Cookie', outsider.cookie);
    await User.updateOne({ _id: outsider.id }, { $set: { accountStatus: 'SUSPENDED' } });
    expect(
      (
        await request(app)
          .get(`/api/v1/communities/${privateId}/membership-requests`)
          .set('Cookie', owner.cookie)
      ).body.data.items
    ).toHaveLength(0);
    expect(
      (
        await request(app)
          .post(`/api/v1/communities/${privateId}/membership-requests/${outsiderRequest?.id}/approve`)
          .set('Cookie', owner.cookie)
      ).body.error.code
    ).toBe('APPLICANT_UNAVAILABLE');
    await User.updateOne({ _id: outsider.id }, { $set: { accountStatus: 'ACTIVE' } });
  });

  it('updates authorized settings and archives read-only communities', async () => {
    expect(
      (
        await request(app)
          .patch(`/api/v1/communities/${privateId}`)
          .set('Cookie', member.cookie)
          .send({ visibility: 'PUBLIC' })
      ).status
    ).toBe(403);
    expect(
      (
        await request(app)
          .patch(`/api/v1/communities/${privateId}`)
          .set('Cookie', owner.cookie)
          .send({ description: 'Updated private professional community.' })
      ).body.data.community.description
    ).toBe('Updated private professional community.');
    expect(
      (
        await request(app)
          .patch(`/api/v1/communities/${privateId}`)
          .set('Cookie', owner.cookie)
          .send({ memberCount: 500 })
      ).status
    ).toBe(400);
    expect(
      (await request(app).post(`/api/v1/communities/${privateId}/archive`).set('Cookie', member.cookie))
        .status
    ).toBe(403);
    expect(
      (await request(app).post(`/api/v1/communities/${privateId}/archive`).set('Cookie', owner.cookie)).body
        .data.community.status
    ).toBe('ARCHIVED');
    expect(
      (await request(app).post(`/api/v1/communities/${privateId}/join`).set('Cookie', outsider.cookie)).body
        .error.code
    ).toBe('COMMUNITY_ARCHIVED');
    expect(
      (
        await request(app)
          .patch(`/api/v1/communities/${privateId}`)
          .set('Cookie', owner.cookie)
          .send({ name: 'Changed' })
      ).status
    ).toBe(403);
  });

  it('enforces admin role boundaries, removal, derived counts, and standalone transfer policy', async () => {
    await request(app).post(`/api/v1/communities/${publicId}/join`).set('Cookie', member.cookie);
    const simultaneous = await Promise.all([
      request(app).post(`/api/v1/communities/${publicId}/join`).set('Cookie', outsider.cookie),
      request(app).post(`/api/v1/communities/${publicId}/join`).set('Cookie', outsider.cookie)
    ]);
    expect(simultaneous.every((response) => response.status === 200)).toBe(true);
    expect(await CommunityMembership.countDocuments({ communityId: publicId, userId: outsider.id })).toBe(1);
    await request(app)
      .patch(`/api/v1/communities/${publicId}/members/${member.id}/role`)
      .set('Cookie', owner.cookie)
      .send({ role: 'ADMIN' });
    expect(
      (
        await request(app)
          .patch(`/api/v1/communities/${publicId}/members/${outsider.id}/role`)
          .set('Cookie', member.cookie)
          .send({ role: 'MODERATOR' })
      ).body.data.role
    ).toBe('MODERATOR');
    expect(
      (
        await request(app)
          .patch(`/api/v1/communities/${publicId}/members/${outsider.id}/role`)
          .set('Cookie', member.cookie)
          .send({ role: 'ADMIN' })
      ).status
    ).toBe(403);
    expect(
      (
        await request(app)
          .delete(`/api/v1/communities/${publicId}/members/${outsider.id}`)
          .set('Cookie', member.cookie)
      ).status
    ).toBe(403);
    expect(
      (
        await request(app)
          .delete(`/api/v1/communities/${publicId}/members/${outsider.id}`)
          .set('Cookie', owner.cookie)
      ).body.data.membershipStatus
    ).toBe('REMOVED');
    expect(
      (await request(app).get('/api/v1/communities/react-professionals').set('Cookie', owner.cookie)).body
        .data.community.memberCount
    ).toBe(2);
    expect(
      (
        await request(app)
          .post(`/api/v1/communities/${publicId}/transfer-ownership`)
          .set('Cookie', owner.cookie)
          .send({ newOwnerUserId: member.id })
      ).body.error.code
    ).toBe('REPLICA_SET_REQUIRED');
  });

  it('allows pending users to join directly after an owner makes a community public', async () => {
    const created = await request(app)
      .post('/api/v1/communities')
      .set('Cookie', owner.cookie)
      .send(body('Visibility Guild', 'PRIVATE'));
    const id = created.body.data.community.id as string;
    expect(
      (await request(app).post(`/api/v1/communities/${id}/join`).set('Cookie', outsider.cookie)).body.data
        .membershipStatus
    ).toBe('PENDING');
    expect(
      (
        await request(app)
          .patch(`/api/v1/communities/${id}`)
          .set('Cookie', owner.cookie)
          .send({ visibility: 'PUBLIC' })
      ).body.data.community.visibility
    ).toBe('PUBLIC');
    expect(
      (await request(app).post(`/api/v1/communities/${id}/join`).set('Cookie', outsider.cookie)).body.data
        .membershipStatus
    ).toBe('ACTIVE');
  });

  it('limits repeated community writes per signed-in user', async () => {
    const limitedUser = await signup('Limited Writer', 10);
    let limited = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const response = await request(app)
        .post('/api/v1/communities')
        .set('Cookie', limitedUser.cookie)
        .send({ name: '' });
      if (response.status === 429) {
        limited = true;
        break;
      }
    }
    expect(limited).toBe(true);
  });
});
