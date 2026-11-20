import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../app.js';
import User from '../users/model/User.js';
import Community from '../communities/model/Community.js';
import CommunityMembership from '../memberships/model/CommunityMembership.js';
import CommunityActivity from '../commands/model/CommunityActivity.js';
import ProfessionalEvent from './model/ProfessionalEvent.js';
import EventRegistration from './model/EventRegistration.js';
import MeetupRSVP from './model/MeetupRSVP.js';

let mongo: MongoMemoryReplSet;
let owner: { id: string; cookie: string };
let member: { id: string; cookie: string };
let helper: { id: string; cookie: string };
let outsider: { id: string; cookie: string };
let communityId: string;
let privateId: string;
let eventId: string;
let meetupId: string;
let counter = 0;
const future = new Date(Date.now() + 20 * 86400_000).toISOString();
const later = new Date(Date.now() + 20 * 86400_000 + 3600_000).toISOString();
const eventPayload = {
  title: 'Architecture workshop',
  description: 'A focused architecture workshop for engineers.',
  startAt: future,
  endAt: later,
  timezone: 'UTC',
  locationType: 'online',
  locationOrUrl: 'https://example.com/private-room',
  capacity: 1
};
const meetupPayload = {
  title: 'Frontend coffee meetup',
  description: 'A professional gathering for frontend engineers.',
  scheduledAt: future,
  timezone: 'UTC',
  locationType: 'in_person',
  locationOrUrl: 'Pune, India',
  capacity: 1
};
async function signup(name: string) {
  const response = await request(app)
    .post('/api/v1/auth/signup')
    .send({ name, email: `events-${++counter}@example.test`, password: 'password-123' });
  expect(response.status).toBe(201);
  const id = response.body.data.user.id as string;
  await User.updateOne({ _id: id }, { $set: { onboardingStatus: 'COMPLETED' } });
  return { id, cookie: String(response.headers['set-cookie']?.[0]).split(';')[0] };
}
const api = (cookie: string) => ({
  get: (path: string) => request(app).get(`/api/v1${path}`).set('Cookie', cookie),
  post: (path: string, body: unknown = {}) =>
    request(app).post(`/api/v1${path}`).set('Cookie', cookie).send(body),
  patch: (path: string, body: unknown) =>
    request(app).patch(`/api/v1${path}`).set('Cookie', cookie).send(body),
  put: (path: string, body: unknown) => request(app).put(`/api/v1${path}`).set('Cookie', cookie).send(body),
  delete: (path: string) => request(app).delete(`/api/v1${path}`).set('Cookie', cookie)
});
const publish = (
  community: string,
  cookie: string,
  command: string,
  payload: unknown,
  idempotencyKey?: string
) =>
  api(cookie).post(`/communities/${community}/commands`, {
    command,
    payloadVersion: 1,
    payload,
    idempotencyKey
  });
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  await Promise.all([
    User.init(),
    Community.init(),
    CommunityMembership.init(),
    CommunityActivity.init(),
    ProfessionalEvent.init(),
    EventRegistration.init(),
    MeetupRSVP.init()
  ]);
  owner = await signup('Event Owner');
  member = await signup('Event Member');
  helper = await signup('Event Helper');
  outsider = await signup('Event Outsider');
  const body = (name: string, visibility: string) => ({
    name,
    description: `Professional community for ${name}.`,
    category: 'software-development',
    visibility
  });
  communityId = (await api(owner.cookie).post('/communities', body('Event Guild', 'PUBLIC'))).body.data
    .community.id;
  privateId = (await api(owner.cookie).post('/communities', body('Private Event Guild', 'PRIVATE'))).body.data
    .community.id;
  await api(member.cookie).post(`/communities/${communityId}/join`);
  await api(helper.cookie).post(`/communities/${communityId}/join`);
}, 120_000);
afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

describe('professional events', () => {
  it('creates atomic event and meetup activities through commands, validates inputs and retries', async () => {
    const key = crypto.randomUUID();
    const created = await publish(communityId, owner.cookie, 'event', eventPayload, key);
    expect(created.status).toBe(201);
    eventId = created.body.data.activity.eventId;
    expect(eventId).toBeTruthy();
    expect(created.body.data.activity.payload.locationOrUrl).not.toContain('private-room');
    expect(
      (await publish(communityId, owner.cookie, 'event', eventPayload, key)).body.data.activity.eventId
    ).toBe(eventId);
    expect(await ProfessionalEvent.countDocuments({ communityId, type: 'event' })).toBe(1);
    expect(await CommunityActivity.countDocuments({ communityId, commandType: 'event' })).toBe(1);
    expect((await publish(communityId, outsider.cookie, 'event', eventPayload)).status).toBe(403);
    await api(member.cookie).post(`/communities/${privateId}/join`);
    expect((await publish(privateId, member.cookie, 'meetup', meetupPayload)).status).toBe(403);
    expect(
      (await publish(communityId, owner.cookie, 'event', { ...eventPayload, timezone: 'Mars/Olympus' }))
        .status
    ).toBe(400);
    expect(
      (await publish(communityId, owner.cookie, 'event', { ...eventPayload, endAt: future })).status
    ).toBe(400);
    expect(
      (
        await publish(communityId, owner.cookie, 'meetup', {
          ...meetupPayload,
          locationType: 'hybrid',
          locationOrUrl: 'Join at https://example.com/private-room',
          onlineUrl: 'https://example.com/private-room'
        })
      ).status
    ).toBe(400);
    expect(
      (
        await publish(communityId, owner.cookie, 'event', {
          ...eventPayload,
          startAt: '2025-01-01T10:00:00.000Z'
        })
      ).status
    ).toBe(400);
    const meetup = await publish(communityId, owner.cookie, 'meetup', meetupPayload);
    expect(meetup.status).toBe(201);
    meetupId = meetup.body.data.activity.eventId;
    expect(await ProfessionalEvent.countDocuments({ communityId, type: 'meetup' })).toBe(1);
  });
  it('enforces visibility, privacy, discovery and ownership', async () => {
    const privateEvent = await publish(privateId, owner.cookie, 'event', eventPayload);
    const privateEventId = privateEvent.body.data.activity.eventId;
    expect((await api(outsider.cookie).get(`/events/${privateEventId}`)).status).toBe(403);
    expect((await api(outsider.cookie).get(`/communities/${privateId}/events`)).status).toBe(403);
    const listing = await api(outsider.cookie).get('/events');
    expect(listing.status).toBe(200);
    expect(listing.body.data.items.map((item: { id: string }) => item.id)).not.toContain(privateEventId);
    expect((await api(outsider.cookie).get(`/events/${eventId}`)).body.data.event.onlineUrl).toBeNull();
    expect((await api(member.cookie).get(`/events/${eventId}/attendees`)).status).toBe(403);
    expect(
      (await api(member.cookie).patch(`/events/${eventId}`, { title: 'Unauthorized edit' })).status
    ).toBe(403);
    expect(
      (await api(owner.cookie).patch(`/events/${eventId}`, { title: 'Updated workshop' })).body.data.event
        .title
    ).toBe('Updated workshop');
    expect(
      (await CommunityActivity.findById((await ProfessionalEvent.findById(eventId))?.activityId))?.payload
    ).toMatchObject({ title: 'Updated workshop' });
    expect((await api(outsider.cookie).post(`/events/${eventId}/register`)).status).toBe(403);
  });
  it('registers safely, cancels idempotently and protects capacity', async () => {
    const results = await Promise.all([
      api(member.cookie).post(`/events/${eventId}/register`),
      api(helper.cookie).post(`/events/${eventId}/register`)
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    const winner = results[0].status === 200 ? member : helper;
    const loser = winner === member ? helper : member;
    expect((await api(winner.cookie).post(`/events/${eventId}/register`)).status).toBe(409);
    expect((await api(loser.cookie).get(`/events/${eventId}`)).body.data.event.onlineUrl).toBeNull();
    expect((await api(winner.cookie).get(`/events/${eventId}`)).body.data.event.onlineUrl).toBe(
      eventPayload.locationOrUrl
    );
    expect((await api(owner.cookie).patch(`/events/${eventId}`, { capacity: 0 })).status).toBe(400);
    expect((await api(owner.cookie).get(`/events/${eventId}/attendees`)).body.data.items).toHaveLength(1);
    expect((await api(winner.cookie).delete(`/events/${eventId}/registration`)).status).toBe(200);
    expect((await api(winner.cookie).delete(`/events/${eventId}/registration`)).status).toBe(200);
    expect((await api(loser.cookie).post(`/events/${eventId}/register`)).status).toBe(200);
    expect((await api(owner.cookie).post(`/events/${eventId}/cancel`)).body.data.event.status).toBe(
      'cancelled'
    );
    expect((await api(winner.cookie).post(`/events/${eventId}/register`)).status).toBe(409);
    expect((await api(loser.cookie).get(`/events/${eventId}`)).body.data.event.onlineUrl).toBeNull();
  });
  it('updates meetup RSVPs and counts only going against capacity', async () => {
    expect((await api(outsider.cookie).put(`/events/${meetupId}/rsvp`, { response: 'going' })).status).toBe(
      403
    );
    expect(
      (await api(member.cookie).put(`/events/${meetupId}/rsvp`, { response: 'interested' })).body.data.event
        .interestedCount
    ).toBe(1);
    expect(
      (await api(helper.cookie).put(`/events/${meetupId}/rsvp`, { response: 'going' })).body.data.event
        .confirmedCount
    ).toBe(1);
    expect((await api(member.cookie).put(`/events/${meetupId}/rsvp`, { response: 'going' })).status).toBe(
      409
    );
    const changed = await api(helper.cookie).put(`/events/${meetupId}/rsvp`, { response: 'not_going' });
    expect(changed.body.data.event.confirmedCount).toBe(0);
    expect(
      (await api(member.cookie).put(`/events/${meetupId}/rsvp`, { response: 'going' })).body.data.event
        .interestedCount
    ).toBe(0);
    expect((await api(owner.cookie).get(`/events/${meetupId}/attendees`)).body.data.items[0].response).toBe(
      'going'
    );
    expect(
      (await api(member.cookie).put(`/events/${meetupId}/rsvp`, { response: 'going' })).body.data.event
        .confirmedCount
    ).toBe(1);
  });
  it('rejects capacity reduction below confirmed attendance and past registration', async () => {
    const created = await publish(communityId, owner.cookie, 'event', {
      ...eventPayload,
      title: 'Capacity workshop',
      capacity: 2
    });
    const targetId = created.body.data.activity.eventId as string;
    expect((await api(member.cookie).post(`/events/${targetId}/register`)).status).toBe(200);
    expect((await api(helper.cookie).post(`/events/${targetId}/register`)).status).toBe(200);
    expect((await api(owner.cookie).patch(`/events/${targetId}`, { capacity: 1 })).status).toBe(409);
    await ProfessionalEvent.updateOne(
      { _id: targetId },
      { $set: { startAt: new Date('2025-01-01'), endAt: new Date('2025-01-02') } }
    );
    expect((await api(owner.cookie).post(`/events/${targetId}/register`)).status).toBe(409);
  });
});
