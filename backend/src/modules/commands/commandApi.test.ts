import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../app.js';
import User from '../users/model/User.js';
import Profile from '../profiles/model/Profile.js';
import Community from '../communities/model/Community.js';
import CommunityMembership from '../memberships/model/CommunityMembership.js';
import CommunityActivity from './model/CommunityActivity.js';
import { commandDefinitions } from './registry/commandRegistry.js';

let mongo: MongoMemoryServer;
let owner = { id: '', cookie: '' };
let member = { id: '', cookie: '' };
let outsider = { id: '', cookie: '' };
let publicId = '';
let privateId = '';
let activityId = '';
let counter = 0;
const communityBody = (name: string, visibility: 'PUBLIC' | 'PRIVATE') => ({
  name,
  description: `A professional community for ${name}.`,
  category: 'software-development',
  visibility
});
const payloads = {
  referral: {
    jobTitle: 'Frontend Engineer',
    company: 'Example Co',
    location: 'Pune',
    workMode: 'hybrid',
    jobUrl: 'https://example.com/jobs/1',
    description: 'A frontend engineering opportunity.'
  },
  needreferral: {
    jobTitle: 'Backend Engineer',
    company: 'Example Co',
    experienceLevel: 'mid',
    message: 'I would appreciate a referral for this role.'
  },
  event: {
    title: 'Engineering Forum',
    description: 'A professional engineering discussion.',
    startAt: '2027-01-10T10:00:00.000Z',
    endAt: '2027-01-10T12:00:00.000Z',
    locationType: 'online',
    locationOrUrl: 'https://example.com/event'
  },
  meetup: {
    title: 'Frontend Meetup',
    description: 'A professional meetup for frontend engineers.',
    scheduledAt: '2027-01-11T10:00:00.000Z',
    locationType: 'in_person',
    locationOrUrl: 'Pune, India',
    capacity: 50
  }
} as const;
async function signup(name: string) {
  const response = await request(app)
    .post('/api/v1/auth/signup')
    .send({ name, email: `command-${++counter}@example.test`, password: 'password-123' });
  expect(response.status).toBe(201);
  const id = response.body.data.user.id as string;
  await User.updateOne({ _id: id }, { $set: { onboardingStatus: 'COMPLETED' } });
  return { id, cookie: String(response.headers['set-cookie']?.[0]).split(';')[0] };
}
const publish = (
  communityId: string,
  cookie: string,
  command: string,
  payload: unknown,
  payloadVersion = 1
) =>
  request(app)
    .post(`/api/v1/communities/${communityId}/commands`)
    .set('Cookie', cookie)
    .send({ command, payloadVersion, payload });
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([
    User.init(),
    Profile.init(),
    Community.init(),
    CommunityMembership.init(),
    CommunityActivity.init()
  ]);
  owner = await signup('Command Owner');
  member = await signup('Command Member');
  outsider = await signup('Command Outsider');
  await Profile.create({
    userId: owner.id,
    username: 'command-owner',
    fullName: 'Command Owner',
    headline: 'Engineer',
    country: 'India',
    visibility: 'PUBLIC'
  });
  const publicCommunity = await request(app)
    .post('/api/v1/communities')
    .set('Cookie', owner.cookie)
    .send(communityBody('Command Guild', 'PUBLIC'));
  const privateCommunity = await request(app)
    .post('/api/v1/communities')
    .set('Cookie', owner.cookie)
    .send(communityBody('Private Command Guild', 'PRIVATE'));
  publicId = publicCommunity.body.data.community.id;
  privateId = privateCommunity.body.data.community.id;
  await request(app).post(`/api/v1/communities/${publicId}/join`).set('Cookie', member.cookie);
  await request(app).post(`/api/v1/communities/${privateId}/join`).set('Cookie', member.cookie);
}, 120_000);
afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

describe('structured community commands', () => {
  it('exposes only permitted command metadata to active members', async () => {
    const response = await request(app)
      .get(`/api/v1/communities/${publicId}/commands`)
      .set('Cookie', member.cookie);
    expect(response.status).toBe(200);
    expect(response.body.data.commands.map((item: { command: string }) => item.command)).toEqual([
      '/referral',
      '/needreferral',
      '/event',
      '/meetup'
    ]);
    expect(response.body.data.commands[0]).not.toHaveProperty('schema');
    expect(
      (await request(app).get(`/api/v1/communities/${privateId}/commands`).set('Cookie', member.cookie))
        .status
    ).toBe(403);
    expect(
      (await request(app).get(`/api/v1/communities/${publicId}/commands`).set('Cookie', outsider.cookie))
        .status
    ).toBe(403);
  });

  it('persists all four validated activity types and derives author identity from session', async () => {
    for (const command of ['referral', 'needreferral', 'event', 'meetup'] as const) {
      const response = await publish(publicId, owner.cookie, command, payloads[command]);
      expect(response.status).toBe(201);
      expect(response.body.data.activity.command).toBe(command);
      expect(response.body.data.activity.author).toMatchObject({
        name: 'Command Owner',
        username: 'command-owner'
      });
      expect(response.body.data.activity.author).not.toHaveProperty('email');
      if (command === 'referral') activityId = response.body.data.activity.id;
    }
    expect(await CommunityActivity.countDocuments({ communityId: publicId, status: 'ACTIVE' })).toBe(4);
    expect(
      (await request(app).get(`/api/v1/communities/${publicId}/activities`).set('Cookie', member.cookie)).body
        .data.items
    ).toHaveLength(4);
  });

  it('rejects arbitrary chat, unknown or disabled commands, bad versions, invalid payloads and mass assignment', async () => {
    expect(
      (await publish(publicId, member.cookie, 'hello', { text: 'Hello everyone' })).body.error.code
    ).toBe('COMMAND_UNKNOWN');
    expect(
      (
        await request(app)
          .post(`/api/v1/communities/${publicId}/commands`)
          .set('Cookie', member.cookie)
          .send({ message: 'Hello everyone' })
      ).status
    ).toBe(400);
    expect((await publish(publicId, member.cookie, 'referral', payloads.referral, 2)).body.error.code).toBe(
      'COMMAND_VERSION_UNSUPPORTED'
    );
    expect(
      (await publish(publicId, member.cookie, 'referral', { ...payloads.referral, authorId: owner.id })).body
        .error.code
    ).toBe('COMMAND_PAYLOAD_INVALID');
    expect(
      (
        await publish(publicId, member.cookie, 'needreferral', {
          ...payloads.needreferral,
          message: '<script>alert(1)</script>'
        })
      ).status
    ).toBe(400);
    expect(
      (
        await publish(publicId, member.cookie, 'event', {
          ...payloads.event,
          endAt: '2027-01-09T10:00:00.000Z'
        })
      ).status
    ).toBe(400);
    expect(
      (
        await publish(publicId, member.cookie, 'referral', {
          ...payloads.referral,
          jobUrl: 'javascript:alert(1)'
        })
      ).status
    ).toBe(400);
    expect(
      (
        await request(app)
          .post(`/api/v1/communities/${publicId}/commands`)
          .set('Cookie', member.cookie)
          .send({ command: 'referral', payloadVersion: 1, payload: payloads.referral, authorId: owner.id })
      ).status
    ).toBe(400);
    const definition = commandDefinitions.find((item) => item.id === 'meetup')!;
    definition.enabled = false;
    try {
      expect((await publish(publicId, member.cookie, 'meetup', payloads.meetup)).body.error.code).toBe(
        'COMMAND_DISABLED'
      );
    } finally {
      definition.enabled = true;
    }
  });

  it('requires active membership and blocks archived communities', async () => {
    expect((await publish(privateId, member.cookie, 'referral', payloads.referral)).status).toBe(403);
    expect((await publish(publicId, outsider.cookie, 'referral', payloads.referral)).status).toBe(403);
    await request(app).delete(`/api/v1/communities/${publicId}/membership`).set('Cookie', member.cookie);
    expect((await publish(publicId, member.cookie, 'referral', payloads.referral)).status).toBe(403);
    await request(app).post(`/api/v1/communities/${publicId}/join`).set('Cookie', member.cookie);
    await request(app).post(`/api/v1/communities/${privateId}/archive`).set('Cookie', owner.cookie);
    expect((await publish(privateId, owner.cookie, 'referral', payloads.referral)).body.error.code).toBe(
      'COMMUNITY_ARCHIVED'
    );
  });

  it('enforces private activity access, command filters and cursor pagination', async () => {
    const another = await request(app)
      .post('/api/v1/communities')
      .set('Cookie', owner.cookie)
      .send(communityBody('Private Activity Guild', 'PRIVATE'));
    const otherId = another.body.data.community.id as string;
    await publish(otherId, owner.cookie, 'event', payloads.event);
    expect(
      (await request(app).get(`/api/v1/communities/${otherId}/activities`).set('Cookie', member.cookie))
        .status
    ).toBe(403);
    expect(
      (await request(app).get(`/api/v1/communities/${otherId}/activities`).set('Cookie', owner.cookie)).body
        .data.items
    ).toHaveLength(1);
    const first = await request(app)
      .get(`/api/v1/communities/${publicId}/activities?limit=1`)
      .set('Cookie', member.cookie);
    expect(first.body.data.hasMore).toBe(true);
    const second = await request(app)
      .get(`/api/v1/communities/${publicId}/activities`)
      .query({ limit: 1, cursor: first.body.data.nextCursor })
      .set('Cookie', member.cookie);
    expect(second.body.data.items[0].id).not.toBe(first.body.data.items[0].id);
    const filtered = await request(app)
      .get(`/api/v1/communities/${publicId}/activities?command=referral`)
      .set('Cookie', member.cookie);
    expect(filtered.body.data.items.map((item: { command: string }) => item.command)).toEqual(['referral']);
    expect(
      (
        await request(app)
          .get(`/api/v1/communities/${publicId}/activities?cursor=bad`)
          .set('Cookie', member.cookie)
      ).status
    ).toBe(400);
    expect(
      (
        await request(app)
          .get(`/api/v1/communities/${publicId}/activities?limit=51`)
          .set('Cookie', member.cookie)
      ).status
    ).toBe(400);
  });

  it('permits author and moderator deletion, prevents unrelated and cross-community deletion, clears payload', async () => {
    expect(
      (
        await request(app)
          .delete(`/api/v1/communities/${publicId}/activities/${activityId}`)
          .set('Cookie', member.cookie)
      ).status
    ).toBe(403);
    expect(
      (
        await request(app)
          .delete(`/api/v1/communities/${privateId}/activities/${activityId}`)
          .set('Cookie', owner.cookie)
      ).status
    ).toBe(409);
    expect(
      (
        await request(app)
          .delete(`/api/v1/communities/${publicId}/activities/${activityId}`)
          .set('Cookie', owner.cookie)
      ).status
    ).toBe(200);
    expect((await CommunityActivity.findById(activityId))?.payload).toBeNull();
    expect(
      (
        await request(app)
          .get(`/api/v1/communities/${publicId}/activities?command=referral`)
          .set('Cookie', member.cookie)
      ).body.data.items
    ).toHaveLength(0);
    const byMember = await publish(publicId, member.cookie, 'needreferral', payloads.needreferral);
    const memberActivityId = byMember.body.data.activity.id as string;
    expect(
      (
        await request(app)
          .delete(`/api/v1/communities/${publicId}/activities/${memberActivityId}`)
          .set('Cookie', member.cookie)
      ).status
    ).toBe(200);
    const moderated = await publish(publicId, member.cookie, 'meetup', payloads.meetup);
    expect(
      (
        await request(app)
          .delete(`/api/v1/communities/${publicId}/activities/${moderated.body.data.activity.id}`)
          .set('Cookie', owner.cookie)
      ).status
    ).toBe(200);
  });

  it('rate-limits repeated submissions', async () => {
    const writer = await signup('Rate Limited Writer');
    await request(app).post(`/api/v1/communities/${publicId}/join`).set('Cookie', writer.cookie);
    let limited = false;
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const response = await publish(publicId, writer.cookie, 'badcommand', {});
      if (response.status === 429) {
        limited = true;
        break;
      }
    }
    expect(limited).toBe(true);
  });
});
