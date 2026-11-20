import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../app.js';
import User from '../users/model/User.js';
import Profile from '../profiles/model/Profile.js';
import Post from '../posts/model/Post.js';
import PostBookmark from '../posts/model/PostBookmark.js';
import Bookmark from './model/Bookmark.js';
import BookmarkCollection from './model/BookmarkCollection.js';
import BookmarkCollectionItem from './model/BookmarkCollectionItem.js';

let mongo: MongoMemoryServer;
let first = '';
let second = '';
let postId = '';
let savedId = '';
let collectionId = '';
async function account(name: string, email: string) {
  const signup = await request(app)
    .post('/api/v1/auth/signup')
    .send({ name, email, password: 'password-123' });
  expect(signup.status).toBe(201);
  const userId = signup.body.data.user.id;
  await User.updateOne({ _id: userId }, { $set: { onboardingStatus: 'COMPLETED' } });
  await Profile.create({
    userId,
    username: name.toLowerCase().replace(' ', '-'),
    fullName: name,
    headline: 'Engineer',
    country: 'India',
    visibility: 'PUBLIC'
  });
  return String(signup.headers['set-cookie']?.[0]).split(';')[0];
}
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([
    User.init(),
    Profile.init(),
    Post.init(),
    PostBookmark.init(),
    Bookmark.init(),
    BookmarkCollection.init(),
    BookmarkCollectionItem.init()
  ]);
  first = await account('First Author', 'bookmark-first@example.test');
  second = await account('Second Reader', 'bookmark-second@example.test');
  const post = await request(app)
    .post('/api/v1/posts')
    .set('Cookie', first)
    .send({ content: 'A useful engineering post' });
  expect(post.status).toBe(201);
  postId = post.body.data.post.id;
}, 120_000);
afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

describe('private bookmarks and activity', () => {
  it('requires a session and rejects missing targets', async () => {
    expect((await request(app).get('/api/v1/bookmarks')).status).toBe(401);
    const missing = await request(app)
      .post('/api/v1/bookmarks')
      .set('Cookie', second)
      .send({ entityType: 'post', entityId: new mongoose.Types.ObjectId().toString() });
    expect(missing.status).toBe(404);
    expect(
      (await request(app).get('/api/v1/bookmarks/status?entities=post:bad').set('Cookie', second)).status
    ).toBe(400);
  });
  it('saves idempotently, migrates legacy post saves, and keeps ownership private', async () => {
    const created = await request(app)
      .post('/api/v1/bookmarks')
      .set('Cookie', second)
      .send({ entityType: 'post', entityId: postId });
    expect(created.status).toBe(201);
    savedId = created.body.data.id;
    const repeated = await request(app)
      .post('/api/v1/bookmarks')
      .set('Cookie', second)
      .send({ entityType: 'post', entityId: postId });
    expect(repeated.body.data.id).toBe(savedId);
    expect((await request(app).get('/api/v1/bookmarks').set('Cookie', second)).body.data.items).toMatchObject(
      [{ id: savedId, available: true }]
    );
    expect((await request(app).get('/api/v1/bookmarks').set('Cookie', first)).body.data.items).toEqual([]);
    expect(
      (await request(app).delete(`/api/v1/bookmarks/${savedId}`).set('Cookie', first)).body.data.removed
    ).toBe(false);
    const user = await User.findOne({ email: 'bookmark-first@example.test' });
    await PostBookmark.create({ userId: user!._id, postId });
    const migrated = await request(app).get('/api/v1/bookmarks').set('Cookie', first);
    expect(migrated.body.data.items).toHaveLength(1);
    expect(await PostBookmark.countDocuments({ userId: user!._id })).toBe(0);
  });
  it('keeps collections private and removing a save preserves its post', async () => {
    const created = await request(app)
      .post('/api/v1/collections')
      .set('Cookie', second)
      .send({ name: 'Reading' });
    expect(created.status).toBe(201);
    collectionId = created.body.data.id;
    expect(
      (await request(app).put(`/api/v1/collections/${collectionId}/items/${savedId}`).set('Cookie', first))
        .status
    ).toBe(404);
    expect(
      (await request(app).put(`/api/v1/collections/${collectionId}/items/${savedId}`).set('Cookie', second))
        .status
    ).toBe(200);
    expect(
      (await request(app).get('/api/v1/bookmarks').set('Cookie', second)).body.data.items[0].collectionIds
    ).toContain(collectionId);
    expect(
      (await request(app).delete(`/api/v1/bookmarks/${savedId}`).set('Cookie', second)).body.data.removed
    ).toBe(true);
    expect(
      (
        await request(app)
          .get('/api/v1/posts/' + postId)
          .set('Cookie', second)
      ).status
    ).toBe(200);
    expect(await BookmarkCollectionItem.countDocuments({ bookmarkId: savedId })).toBe(0);
  });
  it('derives private activity from current canonical records', async () => {
    const activity = await request(app).get('/api/v1/me/activity?type=post').set('Cookie', first);
    expect(activity.status).toBe(200);
    expect(activity.body.data.items).toMatchObject([{ type: 'post', title: 'You published a post.' }]);
    expect(
      (await request(app).get('/api/v1/me/activity?type=post').set('Cookie', second)).body.data.items
    ).toEqual([]);
  });
});
