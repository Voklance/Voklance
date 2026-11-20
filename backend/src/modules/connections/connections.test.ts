import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../../app.js';
import User from '../users/model/User.js';
import Profile from '../profiles/model/Profile.js';
import Skill from '../skills/model/Skill.js';
import UserSkill from '../skills/model/UserSkill.js';
import Connection from './model/Connection.js';

let mongo: MongoMemoryServer;
const people: { id: string; cookie: string; username: string }[] = [];
const call = (_index: number) => request(app);
const auth = (index: number) => ({ Cookie: people[index].cookie });
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), Profile.init(), Skill.init(), UserSkill.init(), Connection.init()]);
  for (let index = 0; index < 5; index++) {
    const result = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        name: `Network User ${index}`,
        email: `network${index}@example.test`,
        password: 'password-123'
      });
    if (result.status !== 201) throw new Error('Could not create networking test account');
    const id = result.body.data.user.id as string;
    people.push({
      id,
      cookie: String(result.headers['set-cookie']?.[0]).split(';')[0],
      username: `network-user-${index}`
    });
    await User.updateOne({ _id: id }, { $set: { onboardingStatus: 'COMPLETED' } });
    await Profile.create({
      userId: id,
      username: people[index].username,
      fullName: `Network User ${index}`,
      headline: index === 1 ? 'Platform Engineer' : 'Product Designer',
      city: index === 1 ? 'Delhi' : 'Mumbai',
      country: 'India',
      visibility: index === 4 ? 'PRIVATE' : 'PUBLIC'
    });
  }
  const skill = await Skill.create({ name: 'TypeScript', slug: 'typescript', category: 'Engineering' });
  await UserSkill.create({ userId: people[1].id, skillId: skill._id });
}, 120_000);
beforeEach(async () => {
  await Connection.deleteMany({});
  await Profile.updateMany(
    {},
    {
      $set: { profileDiscoverable: true, allowConnectionRequests: true, connectionListVisibility: 'private' }
    }
  );
});
afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

describe('professional networking', () => {
  it('requires a session, blocks self requests and hidden recipients', async () => {
    expect(
      (await call(0).post('/api/v1/connections/requests').send({ recipientId: people[1].id })).status
    ).toBe(401);
    expect(
      (await call(0).post('/api/v1/connections/requests').set(auth(0)).send({ recipientId: people[0].id }))
        .status
    ).toBe(400);
    expect(
      (await call(0).post('/api/v1/connections/requests').set(auth(0)).send({ recipientId: people[4].id }))
        .status
    ).toBe(404);
    expect(
      (
        await call(0)
          .post('/api/v1/connections/requests')
          .set(auth(0))
          .send({ requesterId: people[2].id, recipientId: people[1].id })
      ).status
    ).toBe(400);
  });
  it('allows one pending pair even with concurrent and reciprocal sends', async () => {
    const results = await Promise.all(
      [0, 1].map(() =>
        call(0).post('/api/v1/connections/requests').set(auth(0)).send({ recipientId: people[1].id })
      )
    );
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(
      (await call(1).post('/api/v1/connections/requests').set(auth(1)).send({ recipientId: people[0].id }))
        .status
    ).toBe(409);
    expect(await Connection.countDocuments()).toBe(1);
    expect(
      (await call(0).get(`/api/v1/connections/status/${people[1].id}`).set(auth(0))).body.data.status
    ).toBe('pending_sent');
    expect(
      (await call(1).get(`/api/v1/connections/status/${people[0].id}`).set(auth(1))).body.data.status
    ).toBe('pending_received');
  });
  it('enforces direction, accepts once, counts accepted pairs and allows either side to remove', async () => {
    const sent = await call(0)
      .post('/api/v1/connections/requests')
      .set(auth(0))
      .send({ recipientUsername: people[1].username });
    const id = sent.body.data.connection.id as string;
    expect((await call(0).post(`/api/v1/connections/requests/${id}/accept`).set(auth(0))).status).toBe(404);
    expect((await call(2).delete(`/api/v1/connections/requests/${id}`).set(auth(2))).status).toBe(404);
    expect((await call(1).post(`/api/v1/connections/requests/${id}/accept`).set(auth(1))).status).toBe(200);
    expect((await call(1).post(`/api/v1/connections/requests/${id}/accept`).set(auth(1))).status).toBe(404);
    expect((await call(0).get('/api/v1/connections/counts').set(auth(0))).body.data.counts.connections).toBe(
      1
    );
    expect(
      (await call(1).get('/api/v1/connections/me').set(auth(1))).body.data.items[0].person.username
    ).toBe(people[0].username);
    expect((await call(2).delete(`/api/v1/connections/${id}`).set(auth(2))).status).toBe(404);
    expect((await call(1).delete(`/api/v1/connections/${id}`).set(auth(1))).status).toBe(200);
    expect((await call(0).get('/api/v1/connections/counts').set(auth(0))).body.data.counts.connections).toBe(
      0
    );
  });
  it('declines and cancels only pending requests and enforces cooldown', async () => {
    const first = await call(0)
      .post('/api/v1/connections/requests')
      .set(auth(0))
      .send({ recipientId: people[1].id });
    const firstId = first.body.data.connection.id as string;
    expect((await call(0).post(`/api/v1/connections/requests/${firstId}/decline`).set(auth(0))).status).toBe(
      404
    );
    expect((await call(1).post(`/api/v1/connections/requests/${firstId}/decline`).set(auth(1))).status).toBe(
      200
    );
    expect(
      (await call(0).post('/api/v1/connections/requests').set(auth(0)).send({ recipientId: people[1].id }))
        .body.error.code
    ).toBe('REREQUEST_COOLDOWN');
    const second = await call(0)
      .post('/api/v1/connections/requests')
      .set(auth(0))
      .send({ recipientId: people[2].id });
    const secondId = second.body.data.connection.id as string;
    expect((await call(1).delete(`/api/v1/connections/requests/${secondId}`).set(auth(1))).status).toBe(404);
    expect((await call(0).delete(`/api/v1/connections/requests/${secondId}`).set(auth(0))).status).toBe(200);
    expect(
      (await call(0).post('/api/v1/connections/requests').set(auth(0)).send({ recipientId: people[2].id }))
        .body.error.code
    ).toBe('REREQUEST_COOLDOWN');
  });
  it('filters discovery by search, skill, location and discoverability without private fields', async () => {
    const searched = await call(0)
      .get('/api/v1/professionals?search=Engineer&skill=typescript&location=Delhi')
      .set(auth(0));
    expect(searched.status).toBe(200);
    expect(searched.body.data.items).toHaveLength(1);
    expect(searched.body.data.items[0]).toMatchObject({
      username: people[1].username,
      skills: ['TypeScript']
    });
    for (const key of ['email', 'passwordHash', 'accountStatus', 'onboardingStatus'])
      expect(searched.body.data.items[0]).not.toHaveProperty(key);
    expect(
      (await call(0).get('/api/v1/professionals?location=Moon').set(auth(0))).body.data.items
    ).toHaveLength(0);
    expect(
      (await call(0).get('/api/v1/professionals').set(auth(0))).body.data.items.some(
        (item: { username: string }) => item.username === people[4].username
      )
    ).toBe(false);
    const settings = await call(1).patch('/api/v1/profiles/me/network-settings').set(auth(1)).send({
      profileDiscoverable: false,
      allowConnectionRequests: false,
      connectionListVisibility: 'connections'
    });
    expect(settings.status).toBe(200);
    expect(
      (await call(0).get('/api/v1/professionals').set(auth(0))).body.data.items.some(
        (item: { username: string }) => item.username === people[1].username
      )
    ).toBe(false);
    expect(
      (await call(3).post('/api/v1/connections/requests').set(auth(3)).send({ recipientId: people[1].id }))
        .status
    ).toBe(404);
    await Profile.updateOne(
      { userId: people[1].id },
      {
        $set: {
          profileDiscoverable: true,
          allowConnectionRequests: true,
          connectionListVisibility: 'private'
        }
      }
    );
  });
  it('paginates discovery, requests and connection search without cross-user exposure', async () => {
    const page = await call(0).get('/api/v1/professionals?limit=1').set(auth(0));
    expect(page.body.data.items).toHaveLength(1);
    expect(page.body.data.hasMore).toBe(true);
    const next = await call(0)
      .get(`/api/v1/professionals?limit=1&cursor=${page.body.data.nextCursor}`)
      .set(auth(0));
    expect(next.body.data.items[0].userId).not.toBe(page.body.data.items[0].userId);
    await call(3).post('/api/v1/connections/requests').set(auth(3)).send({ recipientId: people[1].id });
    await call(2).post('/api/v1/connections/requests').set(auth(2)).send({ recipientId: people[1].id });
    const incoming = await call(1).get('/api/v1/connections/requests/incoming?limit=1').set(auth(1));
    expect(incoming.body.data.items).toHaveLength(1);
    expect(incoming.body.data.hasMore).toBe(true);
    const incomingNext = await call(1)
      .get(`/api/v1/connections/requests/incoming?limit=1&cursor=${incoming.body.data.nextCursor}`)
      .set(auth(1));
    expect(incomingNext.body.data.items[0].id).not.toBe(incoming.body.data.items[0].id);
    expect(
      (await call(3).get('/api/v1/connections/requests/incoming').set(auth(3))).body.data.items
    ).toHaveLength(0);
    expect(
      (await call(3).get('/api/v1/connections/requests/sent').set(auth(3))).body.data.items
    ).toHaveLength(1);
  });
  it('shares a list only with accepted connections when enabled and omits private profiles', async () => {
    for (const other of [0, 2, 4]) {
      const [low, high] = [people[1].id, people[other].id].sort();
      await Connection.create({
        userLowId: low,
        userHighId: high,
        requesterId: people[1].id,
        recipientId: people[other].id,
        status: 'accepted',
        requestedAt: new Date(),
        respondedAt: new Date()
      });
    }
    const url = `/api/v1/connections/users/${people[1].username}`;
    expect((await call(0).get(url).set(auth(0))).status).toBe(404);
    await Profile.updateOne({ userId: people[1].id }, { $set: { connectionListVisibility: 'connections' } });
    expect((await call(3).get(url).set(auth(3))).status).toBe(404);
    const list = await call(0).get(url).set(auth(0));
    expect(list.status).toBe(200);
    expect(list.body.data.items.map((item: { username: string }) => item.username).sort()).toEqual(
      [people[0].username, people[2].username].sort()
    );
    expect(
      (await call(0).get(`/api/v1/connections/status/by-username/${people[1].username}`).set(auth(0))).body
        .data.connectionCount
    ).toBe(3);
    expect(
      (await call(3).get(`/api/v1/connections/status/by-username/${people[1].username}`).set(auth(3))).body
        .data.connectionCount
    ).toBeNull();
  });
  it('searches and paginates accepted connections with safe summaries', async () => {
    for (const other of [1, 2, 3]) {
      const [low, high] = [people[0].id, people[other].id].sort();
      await Connection.create({
        userLowId: low,
        userHighId: high,
        requesterId: people[0].id,
        recipientId: people[other].id,
        status: 'accepted',
        requestedAt: new Date(),
        respondedAt: new Date()
      });
    }
    const first = await call(0).get('/api/v1/connections/me?limit=1').set(auth(0));
    expect(first.body.data.items).toHaveLength(1);
    expect(first.body.data.hasMore).toBe(true);
    expect(first.body.data.counts.connections).toBe(3);
    const second = await call(0)
      .get(`/api/v1/connections/me?limit=1&cursor=${first.body.data.nextCursor}`)
      .set(auth(0));
    expect(second.body.data.items[0].id).not.toBe(first.body.data.items[0].id);
    const searched = await call(0).get('/api/v1/connections/me?search=User%202').set(auth(0));
    expect(searched.body.data.items).toHaveLength(1);
    expect(searched.body.data.items[0].person.username).toBe(people[2].username);
    expect(searched.body.data.items[0].person).not.toHaveProperty('email');
  });
  it('permits a new request after the configured cooldown', async () => {
    const [low, high] = [people[2].id, people[3].id].sort();
    const record = await Connection.create({
      userLowId: low,
      userHighId: high,
      requesterId: people[2].id,
      recipientId: people[3].id,
      status: 'removed',
      requestedAt: new Date('2020-01-01'),
      respondedAt: new Date('2020-01-02')
    });
    await Connection.updateOne(
      { _id: record._id },
      { $set: { updatedAt: new Date('2020-01-03') } },
      { timestamps: false }
    );
    const renewed = await call(3)
      .post('/api/v1/connections/requests')
      .set(auth(3))
      .send({ recipientId: people[2].id });
    expect(renewed.status).toBe(201);
    expect(renewed.body.data.connection).toMatchObject({
      id: record._id.toString(),
      status: 'pending',
      requesterId: people[3].id,
      recipientId: people[2].id
    });
    expect(await Connection.countDocuments()).toBe(1);
  });
});
