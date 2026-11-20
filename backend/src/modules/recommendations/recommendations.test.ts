import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../app.js';
import User from '../users/model/User.js';
import Profile from '../profiles/model/Profile.js';
import Post from '../posts/model/Post.js';
import Connection from '../connections/model/Connection.js';
import RecommendationFeedback from './model/RecommendationFeedback.js';
import UserFeedPreference from './model/UserFeedPreference.js';

let mongo: MongoMemoryServer;
const accounts: { id: string; cookie: string }[] = [];
let connectedPostId = '';
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([
    User.init(),
    Profile.init(),
    Post.init(),
    Connection.init(),
    RecommendationFeedback.init(),
    UserFeedPreference.init()
  ]);
  for (let index = 0; index < 4; index++) {
    const result = await request(app)
      .post('/api/v1/auth/signup')
      .send({ name: `Feed User ${index}`, email: `feed${index}@example.test`, password: 'password-123' });
    accounts.push({
      id: result.body.data.user.id,
      cookie: String(result.headers['set-cookie']?.[0]).split(';')[0]
    });
    await User.updateOne({ _id: accounts[index].id }, { $set: { onboardingStatus: 'COMPLETED' } });
    await Profile.create({
      userId: accounts[index].id,
      username: `feed-user-${index}`,
      fullName: `Feed User ${index}`,
      headline: 'Software developer',
      country: 'India',
      visibility: index === 3 ? 'PRIVATE' : 'PUBLIC'
    });
  }
  const [low, high] = [accounts[0].id, accounts[1].id].sort();
  await Connection.create({
    userLowId: low,
    userHighId: high,
    requesterId: accounts[0].id,
    recipientId: accounts[1].id,
    status: 'accepted',
    requestedAt: new Date(),
    respondedAt: new Date()
  });
  const connected = await Post.create({
    authorId: accounts[1].id,
    content: 'Practical TypeScript patterns for applications',
    status: 'PUBLISHED'
  });
  connectedPostId = connected._id.toString();
  await Post.create({
    authorId: accounts[2].id,
    content: 'Gardening notes for the weekend',
    status: 'PUBLISHED'
  });
  await Post.create({
    authorId: accounts[3].id,
    content: 'Private profile secret TypeScript update',
    status: 'PUBLISHED'
  });
}, 120_000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
const auth = () => ({ Cookie: accounts[0].cookie });
describe('personalized recommendations', () => {
  it('ranks explicit interest and connection signals, keeps private authors out, and supports following', async () => {
    expect(
      (
        await request(app)
          .patch('/api/v1/recommendations/preferences')
          .set(auth())
          .send({ topics: ['TypeScript'] })
      ).status
    ).toBe(200);
    const forYou = await request(app).get('/api/v1/feed/for-you').set(auth());
    expect(forYou.status).toBe(200);
    expect(forYou.body.data.items[0].id).toBe(connectedPostId);
    expect(forYou.body.data.items[0].reason).toContain('connection');
    expect(forYou.body.data.items).toHaveLength(2);
    expect(JSON.stringify(forYou.body.data)).not.toContain('Private profile secret');
    const following = await request(app).get('/api/v1/feed/following').set(auth());
    expect(following.body.data.items.map((item: { id: string }) => item.id)).toEqual([connectedPostId]);
  });
  it('stores hide feedback, removes the post, and supports undo', async () => {
    const saved = await request(app)
      .post('/api/v1/recommendations/feedback')
      .set(auth())
      .send({ entityType: 'post', entityId: connectedPostId, action: 'hidden' });
    expect(saved.status).toBe(200);
    const hidden = await request(app).get('/api/v1/feed/for-you').set(auth());
    expect(hidden.body.data.items.some((item: { id: string }) => item.id === connectedPostId)).toBe(false);
    expect(
      (await request(app).delete(`/api/v1/recommendations/feedback/${saved.body.data.id}`).set(auth())).status
    ).toBe(200);
    expect((await request(app).get('/api/v1/feed/for-you').set(auth())).body.data.items[0].id).toBe(
      connectedPostId
    );
  });
  it('suggests only discoverable people without an existing connection and allows dismissal', async () => {
    const suggestions = await request(app).get('/api/v1/recommendations/people').set(auth());
    expect(suggestions.status).toBe(200);
    expect(suggestions.body.data.items.map((item: { title: string }) => item.title)).toEqual(['Feed User 2']);
    const id = String(suggestions.body.data.items[0].id).split(':')[1];
    const dismissed = await request(app)
      .post('/api/v1/recommendations/feedback')
      .set(auth())
      .send({ entityType: 'people', entityId: id, action: 'dismissed' });
    expect(dismissed.status).toBe(200);
    expect(
      (await request(app).get('/api/v1/recommendations/people').set(auth())).body.data.items
    ).toHaveLength(0);
    expect(
      (await request(app).delete(`/api/v1/recommendations/feedback/${dismissed.body.data.id}`).set(auth()))
        .status
    ).toBe(200);
  });
});
