import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../app.js';
import User from '../users/model/User.js';
import Community from './model/Community.js';
import CommunityMembership from '../memberships/model/CommunityMembership.js';

let replica: MongoMemoryReplSet;
let owner = { id: '', cookie: '' };
let nextOwner = { id: '', cookie: '' };
let outsider = { id: '', cookie: '' };
async function signup(name: string, email: string) {
  const response = await request(app)
    .post('/api/v1/auth/signup')
    .send({ name, email, password: 'password-123' });
  expect(response.status).toBe(201);
  const id = response.body.data.user.id as string;
  await User.updateOne({ _id: id }, { $set: { onboardingStatus: 'COMPLETED' } });
  return { id, cookie: String(response.headers['set-cookie']?.[0]).split(';')[0] };
}
beforeAll(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replica.getUri());
  await Promise.all([User.init(), Community.init(), CommunityMembership.init()]);
  owner = await signup('Transfer Owner', 'transfer-owner@example.test');
  nextOwner = await signup('Transfer Member', 'transfer-member@example.test');
  outsider = await signup('Transfer Outsider', 'transfer-outsider@example.test');
}, 120_000);
afterAll(async () => {
  await mongoose.disconnect();
  if (replica) await replica.stop();
});

describe('replica-set ownership transfer', () => {
  it('creates owner and community together, rejects nonmembers, then transfers in one transaction', async () => {
    const created = await request(app).post('/api/v1/communities').set('Cookie', owner.cookie).send({
      name: 'Ownership Guild',
      description: 'A professional community for ownership tests.',
      category: 'software-development',
      visibility: 'PUBLIC'
    });
    expect(created.status).toBe(201);
    const communityId = created.body.data.community.id as string;
    expect((await CommunityMembership.findOne({ communityId, userId: owner.id }))?.role).toBe('OWNER');
    expect(
      (
        await request(app)
          .post(`/api/v1/communities/${communityId}/transfer-ownership`)
          .set('Cookie', owner.cookie)
          .send({ newOwnerUserId: outsider.id })
      ).body.error.code
    ).toBe('TARGET_NOT_MEMBER');
    expect((await Community.findById(communityId))?.ownerId.toString()).toBe(owner.id);
    await request(app).post(`/api/v1/communities/${communityId}/join`).set('Cookie', nextOwner.cookie);
    const transferred = await request(app)
      .post(`/api/v1/communities/${communityId}/transfer-ownership`)
      .set('Cookie', owner.cookie)
      .send({ newOwnerUserId: nextOwner.id });
    expect(transferred.status).toBe(200);
    expect((await Community.findById(communityId))?.ownerId.toString()).toBe(nextOwner.id);
    expect((await CommunityMembership.findOne({ communityId, userId: owner.id }))?.role).toBe('ADMIN');
    expect((await CommunityMembership.findOne({ communityId, userId: nextOwner.id }))?.role).toBe('OWNER');
    expect(
      (await request(app).delete(`/api/v1/communities/${communityId}/membership`).set('Cookie', owner.cookie))
        .status
    ).toBe(200);
    expect(
      (
        await request(app)
          .delete(`/api/v1/communities/${communityId}/membership`)
          .set('Cookie', nextOwner.cookie)
      ).body.error.code
    ).toBe('OWNER_TRANSFER_REQUIRED');
  });
});
