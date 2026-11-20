import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../app.js';
import User from '../users/model/User.js';
import Community from '../communities/model/Community.js';
import CommunityMembership from '../memberships/model/CommunityMembership.js';
import CommunityActivity from '../commands/model/CommunityActivity.js';
import StoredFile from './model/StoredFile.js';
import CommunityResource from './model/CommunityResource.js';
import ResourceReport from './model/ResourceReport.js';

let mongo: MongoMemoryReplSet;
let owner: { id: string; cookie: string };
let member: { id: string; cookie: string };
let moderator: { id: string; cookie: string };
let outsider: { id: string; cookie: string };
let publicId = '';
let privateId = '';
let resourceId = '';
let fileId = '';
let activityId = '';
let counter = 0;
async function signup(name: string) {
  const result = await request(app)
    .post('/api/v1/auth/signup')
    .send({ name, email: `resource-${++counter}@example.test`, password: 'password-123' });
  expect(result.status).toBe(201);
  const id = result.body.data.user.id as string;
  await User.updateOne({ _id: id }, { $set: { onboardingStatus: 'COMPLETED' } });
  return { id, cookie: String(result.headers['set-cookie']?.[0]).split(';')[0] };
}
const api = (cookie: string) => ({
  get: (path: string) => request(app).get(`/api/v1${path}`).set('Cookie', cookie),
  post: (path: string, body: unknown = {}) =>
    request(app).post(`/api/v1${path}`).set('Cookie', cookie).send(body),
  patch: (path: string, body: unknown) =>
    request(app).patch(`/api/v1${path}`).set('Cookie', cookie).send(body),
  delete: (path: string) => request(app).delete(`/api/v1${path}`).set('Cookie', cookie)
});
async function seedResource(communityId: string, title: string) {
  const file = await StoredFile.create({
    uploadedBy: owner.id,
    storageProvider: 'test-fixture',
    storageKey: crypto.randomUUID(),
    originalFilename: 'private.pdf',
    safeFilename: 'guide.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    checksum: 'a'.repeat(64),
    scanStatus: 'clean',
    status: 'attached'
  });
  const payload = {
    title,
    description: 'A professional learning document for engineers.',
    category: 'learning-material',
    tags: ['react', 'frontend'],
    fileId: file._id.toString()
  };
  const activity = await CommunityActivity.create({
    communityId,
    authorId: owner.id,
    commandType: 'resource',
    payloadVersion: 1,
    payload,
    status: 'ACTIVE'
  });
  const resource = await CommunityResource.create({
    communityId,
    activityId: activity._id,
    createdBy: owner.id,
    ...payload,
    status: 'published'
  });
  return { resource, file, activity };
}
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  await Promise.all([
    User.init(),
    Community.init(),
    CommunityMembership.init(),
    CommunityActivity.init(),
    StoredFile.init(),
    CommunityResource.init(),
    ResourceReport.init()
  ]);
  owner = await signup('Resource Owner');
  member = await signup('Resource Member');
  moderator = await signup('Resource Moderator');
  outsider = await signup('Resource Outsider');
  const body = (name: string, visibility: string) => ({
    name,
    description: `Professional community for ${name}.`,
    category: 'software-development',
    visibility
  });
  publicId = (await api(owner.cookie).post('/communities', body('Resource Guild', 'PUBLIC'))).body.data
    .community.id;
  privateId = (await api(owner.cookie).post('/communities', body('Private Resource Guild', 'PRIVATE'))).body
    .data.community.id;
  await api(member.cookie).post(`/communities/${publicId}/join`);
  await api(moderator.cookie).post(`/communities/${publicId}/join`);
  expect(
    (
      await api(owner.cookie).patch(`/communities/${publicId}/members/${moderator.id}/role`, {
        role: 'MODERATOR'
      })
    ).status
  ).toBe(200);
  await api(member.cookie).post(`/communities/${privateId}/join`);
  const seeded = await seedResource(publicId, 'React interview guide');
  resourceId = seeded.resource._id.toString();
  fileId = seeded.file._id.toString();
  activityId = seeded.activity._id.toString();
}, 120_000);
afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

describe('resource foundation without approved storage', () => {
  it('registers /resource but refuses upload and publication without creating an activity', async () => {
    const commands = await api(owner.cookie).get(`/communities/${publicId}/commands`);
    expect(commands.body.data.commands.map((item: { command: string }) => item.command)).toContain(
      '/resource'
    );
    const capabilities = await api(owner.cookie).get('/resources/capabilities');
    expect(capabilities.body.data.uploadAvailable).toBe(false);
    expect((await api(outsider.cookie).post(`/resources/uploads?communityId=${publicId}`)).status).toBe(403);
    expect((await api(member.cookie).post(`/resources/uploads?communityId=${privateId}`)).status).toBe(403);
    expect(
      (await api(member.cookie).post(`/resources/uploads?communityId=${publicId}`)).body.error.code
    ).toBe('RESOURCE_STORAGE_UNAVAILABLE');
    const payload = {
      title: 'New guide',
      description: 'A useful professional learning guide.',
      category: 'learning-material',
      tags: ['react'],
      fileId
    };
    const before = await CommunityActivity.countDocuments({ communityId: publicId, commandType: 'resource' });
    const result = await api(owner.cookie).post(`/communities/${publicId}/commands`, {
      command: 'resource',
      payloadVersion: 1,
      payload
    });
    expect(result.status).toBe(503);
    expect(await CommunityActivity.countDocuments({ communityId: publicId, commandType: 'resource' })).toBe(
      before
    );
    expect(
      (
        await api(outsider.cookie).post(`/communities/${publicId}/commands`, {
          command: 'resource',
          payloadVersion: 1,
          payload
        })
      ).status
    ).toBe(403);
  });
  it('lists safe metadata with search, filters, paging and private access', async () => {
    const listing = await api(member.cookie).get(
      `/communities/${publicId}/resources?search=React&category=learning-material&tag=react&limit=1`
    );
    expect(listing.status).toBe(200);
    expect(listing.body.data.items[0].title).toBe('React interview guide');
    expect(listing.body.data.items[0].file).not.toHaveProperty('storageKey');
    expect(listing.body.data.items[0].file).not.toHaveProperty('originalFilename');
    expect(listing.body.data.items[0].uploader).not.toHaveProperty('email');
    expect(
      (await api(member.cookie).get(`/communities/${publicId}/resources?tag=typescript`)).body.data.items
    ).toHaveLength(0);
    expect((await api(owner.cookie).get('/resources/mine')).body.data.items[0].id).toBe(resourceId);
    expect((await api(outsider.cookie).get(`/resources/${resourceId}`)).status).toBe(200);
    const privateSeed = await seedResource(privateId, 'Private architecture notes');
    expect((await api(outsider.cookie).get(`/resources/${privateSeed.resource._id}`)).status).toBe(403);
    expect((await api(outsider.cookie).get(`/communities/${privateId}/resources`)).status).toBe(403);
    expect((await api(outsider.cookie).get(`/resources/${resourceId}/download`)).status).toBe(403);
    expect((await api(member.cookie).get(`/resources/${resourceId}/download`)).body.error.code).toBe(
      'RESOURCE_STORAGE_UNAVAILABLE'
    );
    expect((await api(member.cookie).get(`/resources/${resourceId}/preview`)).status).toBe(503);
    expect(
      (await api(member.cookie).get(`/communities/${publicId}/activities?command=resource`)).body.data
        .items[0].resourceId
    ).toBe(resourceId);
  });
  it('edits metadata with ownership and activity consistency', async () => {
    expect(
      (await api(member.cookie).patch(`/resources/${resourceId}`, { title: 'Unauthorized' })).status
    ).toBe(403);
    expect(
      (
        await api(owner.cookie).patch(`/resources/${resourceId}`, {
          fileId: new mongoose.Types.ObjectId().toString()
        })
      ).status
    ).toBe(400);
    const result = await api(owner.cookie).patch(`/resources/${resourceId}`, {
      title: 'Updated React guide',
      tags: ['react']
    });
    expect(result.status).toBe(200);
    expect(result.body.data.resource.title).toBe('Updated React guide');
    expect((await CommunityActivity.findById(activityId))?.payload).toMatchObject({
      title: 'Updated React guide'
    });
  });
  it('keeps reports private and lets moderators hide a published resource', async () => {
    expect((await api(owner.cookie).post(`/resources/${resourceId}/report`, { reason: 'spam' })).status).toBe(
      403
    );
    const submitted = await api(member.cookie).post(`/resources/${resourceId}/report`, {
      reason: 'malicious',
      description: 'This file appears suspicious to me.'
    });
    expect(submitted.status).toBe(201);
    const reportId = submitted.body.data.report.id as string;
    expect(submitted.body.data.report).not.toHaveProperty('reportedBy');
    expect(
      (await api(member.cookie).post(`/resources/${resourceId}/report`, { reason: 'spam' })).status
    ).toBe(409);
    expect((await api(member.cookie).get(`/communities/${publicId}/resource-reports`)).status).toBe(403);
    expect(
      (await api(member.cookie).patch(`/resources/reports/${reportId}`, { decision: 'hide' })).status
    ).toBe(403);
    expect(
      (await api(moderator.cookie).get(`/communities/${publicId}/resource-reports`)).body.data.items[0].id
    ).toBe(reportId);
    expect(
      (await api(moderator.cookie).patch(`/resources/reports/${reportId}`, { decision: 'hide' })).status
    ).toBe(200);
    expect((await api(member.cookie).get(`/resources/${resourceId}`)).status).toBe(404);
    expect((await api(member.cookie).get(`/resources/${resourceId}/download`)).status).toBe(404);
    expect((await api(member.cookie).get(`/communities/${publicId}/resources`)).body.data.items).toHaveLength(
      0
    );
    expect(
      (await api(member.cookie).get(`/communities/${publicId}/activities?command=resource`)).body.data.items
    ).toHaveLength(0);
  });
  it('soft deletes records and revokes access through resource and activity routes', async () => {
    expect((await api(owner.cookie).delete(`/communities/${publicId}/activities/${activityId}`)).status).toBe(
      409
    );
    expect((await api(member.cookie).delete(`/resources/${resourceId}`)).status).toBe(404);
    expect((await api(owner.cookie).delete(`/resources/${resourceId}`)).status).toBe(200);
    expect((await CommunityActivity.findById(activityId))?.status).toBe('DELETED');
    expect((await StoredFile.findById(fileId))?.status).toBe('deleted');
    expect((await api(owner.cookie).get(`/resources/${resourceId}`)).status).toBe(404);
    expect((await api(owner.cookie).get(`/resources/${resourceId}/download`)).status).toBe(404);
  });
});
