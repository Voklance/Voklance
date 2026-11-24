import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../app.js';
import User from '../users/model/User.js';
import Profile from '../profiles/model/Profile.js';
import Post from './model/Post.js';
import PostLike from './model/PostLike.js';
import PostFollow from './model/PostFollow.js';
import ProfessionalExperience from '../profiles/model/ProfessionalExperience.js';
import PostBookmark from './model/PostBookmark.js';
import PostComment from './model/PostComment.js';

let mongo: MongoMemoryServer;
let firstCookie = '';
let secondCookie = '';
let firstId = '';
let secondId = '';
let postId = '';
let commentId = '';
let counter = 0;
const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==',
  'base64'
);

async function signup(name: string) {
  const response = await request(app)
    .post('/api/v1/auth/signup')
    .send({
      name,
      email: `feed-${++counter}@example.test`,
      password: 'password-123'
    });
  expect(response.status).toBe(201);
  await User.updateOne({ _id: response.body.data.user.id }, { $set: { onboardingStatus: 'COMPLETED' } });
  return {
    id: response.body.data.user.id as string,
    cookie: String(response.headers['set-cookie']?.[0]).split(';')[0]
  };
}
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([
    User.init(),
    Profile.init(),
    Post.init(),
    PostLike.init(),
    PostFollow.init(),
    PostBookmark.init(),
    PostComment.init()
  ]);
  const first = await signup('First Author');
  const second = await signup('Second Reader');
  firstCookie = first.cookie;
  secondCookie = second.cookie;
  firstId = first.id;
  secondId = second.id;
  await Profile.create({
    userId: firstId,
    username: 'first-author',
    fullName: 'First Author',
    headline: 'Engineer',
    avatarUrl: 'https://example.test/first-author.jpg',
    country: 'India',
    visibility: 'PUBLIC'
  });
}, 120_000);
afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

describe('professional feed API', () => {
  it('rejects unauthenticated and invalid posts and attachment claims', async () => {
    expect((await request(app).post('/api/v1/posts').send({ content: 'Hello' })).status).toBe(401);
    expect(
      (await request(app).post('/api/v1/posts').set('Cookie', firstCookie).send({ content: ' ' })).status
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/v1/posts')
          .set('Cookie', firstCookie)
          .send({ content: 'Hello', attachmentIds: ['abc'] })
      ).status
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/v1/posts')
          .set('Cookie', firstCookie)
          .send({ content: 'Hello', visibility: 'PUBLIC' })
      ).status
    ).toBe(400);
    expect((await request(app).get('/api/v1/posts?limit=51').set('Cookie', firstCookie)).status).toBe(400);
  });

  it('creates, lists, paginates, and edits only own posts with safe author details', async () => {
    const created = await request(app)
      .post('/api/v1/posts')
      .set('Cookie', firstCookie)
      .send({ content: 'Professional update', visibility: 'PROFESSIONALS' });
    expect(created.status).toBe(201);
    postId = created.body.data.post.id;
    expect(created.body.data.post).toMatchObject({
      content: 'Professional update',
      ownedByMe: true,
      author: {
        name: 'First Author',
        username: 'first-author',
        headline: 'Engineer',
        avatarUrl: 'https://example.test/first-author.jpg'
      }
    });
    expect(created.body.data.post.author).not.toHaveProperty('email');
    const second = await request(app)
      .post('/api/v1/posts')
      .set('Cookie', firstCookie)
      .send({ content: 'Another update' });
    expect(second.status).toBe(201);
    const pageOne = await request(app).get('/api/v1/posts?limit=1').set('Cookie', secondCookie);
    expect(pageOne.status).toBe(200);
    expect(pageOne.body.data.items).toHaveLength(1);
    expect(pageOne.body.data.hasMore).toBe(true);
    const pageTwo = await request(app)
      .get('/api/v1/posts?limit=1')
      .query({ cursor: pageOne.body.data.nextCursor })
      .set('Cookie', secondCookie);
    expect(pageTwo.status).toBe(200);
    expect(pageTwo.body.data.items.map((item: { id: string }) => item.id)).not.toContain(
      pageOne.body.data.items[0].id
    );
    expect((await request(app).get('/api/v1/posts?cursor=bad').set('Cookie', firstCookie)).status).toBe(400);
    expect(
      (
        await request(app)
          .patch(`/api/v1/posts/${postId}`)
          .set('Cookie', secondCookie)
          .send({ content: 'Hijack' })
      ).status
    ).toBe(404);
    const edited = await request(app)
      .patch(`/api/v1/posts/${postId}`)
      .set('Cookie', firstCookie)
      .send({ content: 'Edited update' });
    expect(edited.body.data.post.content).toBe('Edited update');
    expect(
      (await request(app).patch('/api/v1/posts/not-an-id').set('Cookie', firstCookie).send({ content: 'No' }))
        .status
    ).toBe(400);
  });

  it('makes likes and bookmarks idempotent and private', async () => {
    const like = `/api/v1/posts/${postId}/like`;
    expect((await request(app).put(like).set('Cookie', secondCookie)).body.data.likeCount).toBe(1);
    expect((await request(app).put(like).set('Cookie', secondCookie)).body.data.likeCount).toBe(1);
    expect((await request(app).delete(like).set('Cookie', secondCookie)).body.data.likeCount).toBe(0);
    const bookmark = `/api/v1/posts/${postId}/bookmark`;
    expect((await request(app).put(bookmark).set('Cookie', secondCookie)).status).toBe(200);
    expect((await request(app).put(bookmark).set('Cookie', secondCookie)).status).toBe(200);
    expect(
      (await request(app).get('/api/v1/users/me/bookmarks').set('Cookie', secondCookie)).body.data.items
    ).toHaveLength(1);
    expect(
      (await request(app).get('/api/v1/users/me/bookmarks').set('Cookie', firstCookie)).body.data.items
    ).toHaveLength(0);
    expect((await request(app).delete(bookmark).set('Cookie', secondCookie)).status).toBe(200);
  });

  it('uploads photos and PDFs to posts and serves them only to signed-in readers', async () => {
    const photo = await request(app)
      .post('/api/v1/posts')
      .set('Cookie', firstCookie)
      .field('content', 'A photo from work')
      .attach('file', tinyPng, 'work.png');
    expect(photo.status).toBe(201);
    expect(photo.body.data.post.attachment).toMatchObject({
      kind: 'image',
      mimeType: 'image/png',
      filename: 'work.png'
    });
    const photoUrl = photo.body.data.post.attachment.url;
    expect((await request(app).get(photoUrl).set('Cookie', secondCookie)).status).toBe(200);
    expect((await request(app).get(photoUrl)).status).toBe(404);
    const pdf = await request(app)
      .post('/api/v1/posts')
      .set('Cookie', firstCookie)
      .field('content', '')
      .attach('file', Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF'), 'notes.pdf');
    expect(pdf.status).toBe(201);
    expect(pdf.body.data.post.attachment).toMatchObject({ kind: 'document', mimeType: 'application/pdf' });
    expect(
      (await request(app).get(pdf.body.data.post.attachment.url).set('Cookie', secondCookie)).headers[
        'content-disposition'
      ]
    ).toContain('attachment');
    const bad = await request(app)
      .post('/api/v1/posts')
      .set('Cookie', firstCookie)
      .field('content', 'Bad file')
      .attach('file', Buffer.from('<script>bad</script>'), 'bad.pdf');
    expect(bad.status).toBe(400);
    await request(app).delete(`/api/v1/posts/${photo.body.data.post.id}`).set('Cookie', firstCookie);
    expect((await request(app).get(photoUrl).set('Cookie', secondCookie)).status).toBe(404);
  });

  it('uploads and removes a profile photo', async () => {
    const uploaded = await request(app)
      .post('/api/v1/profiles/me/avatar')
      .set('Cookie', firstCookie)
      .attach('file', tinyPng, 'avatar.png');
    expect(uploaded.status).toBe(200);
    const avatarUrl = uploaded.body.data.avatarUrl;
    expect(avatarUrl).toMatch(/^\/api\/v1\/media\/[0-9a-f]{24}$/);
    expect((await request(app).get(avatarUrl)).status).toBe(200);
    expect((await request(app).get('/api/v1/profiles/public/first-author')).body.data.profile.avatarUrl).toBe(
      avatarUrl
    );
    await Profile.updateOne({ userId: firstId }, { $set: { visibility: 'PRIVATE' } });
    expect((await request(app).get(avatarUrl)).status).toBe(404);
    expect((await request(app).get(avatarUrl).set('Cookie', firstCookie)).status).toBe(200);
    await Profile.updateOne({ userId: firstId }, { $set: { visibility: 'PUBLIC' } });
    expect((await request(app).delete('/api/v1/profiles/me/avatar').set('Cookie', firstCookie)).status).toBe(
      200
    );
    expect((await request(app).get(avatarUrl)).status).toBe(404);
  });

  it('uploads and removes a profile cover image', async () => {
    const uploaded = await request(app)
      .post('/api/v1/profiles/me/cover')
      .set('Cookie', firstCookie)
      .attach('file', tinyPng, 'cover.png');
    expect(uploaded.status).toBe(200);
    const coverUrl = uploaded.body.data.coverUrl;
    expect((await request(app).get('/api/v1/profiles/public/first-author')).body.data.profile.coverUrl).toBe(
      coverUrl
    );
    expect((await request(app).get(coverUrl)).status).toBe(200);
    expect((await request(app).delete('/api/v1/profiles/me/cover').set('Cookie', firstCookie)).status).toBe(
      200
    );
    expect((await request(app).get(coverUrl)).status).toBe(404);
  });

  it('stores reactions, follow state, and an experience title when the headline is empty', async () => {
    const like = `/api/v1/posts/${postId}/like`;
    const follow = `/api/v1/posts/${postId}/follow`;
    expect(
      (await request(app).put(like).set('Cookie', secondCookie).send({ reaction: 'love' })).body.data
        .reactionByMe
    ).toBe('love');
    expect(
      (await request(app).put(like).set('Cookie', secondCookie).send({ reaction: 'insightful' })).body.data
        .likeCount
    ).toBe(1);
    expect(
      (await request(app).put(like).set('Cookie', secondCookie).send({ reaction: 'invalid' })).status
    ).toBe(400);
    let view = await request(app).get(`/api/v1/posts/${postId}`).set('Cookie', secondCookie);
    expect(view.body.data.post).toMatchObject({
      reactionByMe: 'insightful',
      reactionCounts: { insightful: 1 }
    });
    expect((await request(app).put(follow).set('Cookie', firstCookie)).status).toBe(400);
    expect((await request(app).put(follow).set('Cookie', secondCookie)).status).toBe(200);
    expect((await request(app).put(follow).set('Cookie', secondCookie)).status).toBe(200);
    view = await request(app).get(`/api/v1/posts/${postId}`).set('Cookie', secondCookie);
    expect(view.body.data.post.followingAuthor).toBe(true);
    await Profile.updateOne({ userId: firstId }, { $set: { headline: '' } });
    await ProfessionalExperience.create({
      userId: firstId,
      jobTitle: 'React Developer',
      companyName: 'Example',
      startDate: new Date('2024-01-01'),
      isCurrent: true
    });
    view = await request(app).get(`/api/v1/posts/${postId}`).set('Cookie', secondCookie);
    expect(view.body.data.post.author.headline).toBe('React Developer');
    expect((await request(app).delete(follow).set('Cookie', secondCookie)).status).toBe(200);
    expect(
      (await request(app).get(`/api/v1/posts/${postId}`).set('Cookie', secondCookie)).body.data.post
        .followingAuthor
    ).toBe(false);
    await request(app).delete(like).set('Cookie', secondCookie);
    await Profile.updateOne({ userId: firstId }, { $set: { headline: 'Engineer' } });
  });

  it('creates, paginates, edits and deletes comments with ownership', async () => {
    const path = `/api/v1/posts/${postId}/comments`;
    expect(
      (
        await request(app)
          .post(path)
          .set('Cookie', secondCookie)
          .send({ content: '<script>alert(1)</script>' })
      ).status
    ).toBe(201);
    const added = await request(app)
      .post(path)
      .set('Cookie', secondCookie)
      .send({ content: 'A useful point' });
    commentId = added.body.data.comment.id;
    expect((await request(app).get(`${path}?limit=1`).set('Cookie', secondCookie)).body.data.hasMore).toBe(
      true
    );
    expect(
      (
        await request(app)
          .patch(`${path}/${commentId}`)
          .set('Cookie', firstCookie)
          .send({ content: 'Hijack' })
      ).status
    ).toBe(404);
    const edited = await request(app)
      .patch(`${path}/${commentId}`)
      .set('Cookie', secondCookie)
      .send({ content: 'Updated thought' });
    expect(edited.body.data.comment.content).toBe('Updated thought');
    expect((await request(app).delete(`${path}/${commentId}`).set('Cookie', firstCookie)).status).toBe(404);
    expect((await request(app).delete(`${path}/${commentId}`).set('Cookie', secondCookie)).status).toBe(200);
    expect(
      (await request(app).get('/api/v1/posts').set('Cookie', firstCookie)).body.data.items.find(
        (item: { id: string }) => item.id === postId
      ).commentCount
    ).toBe(1);
  });

  it('does not leak private profile fields and hides suspended authors', async () => {
    await Profile.updateOne({ userId: firstId }, { $set: { visibility: 'PRIVATE' } });
    const privateFeed = await request(app).get('/api/v1/posts').set('Cookie', secondCookie);
    const author = privateFeed.body.data.items.find((item: { id: string }) => item.id === postId)?.author;
    expect(author).toMatchObject({ name: 'First Author', username: null, headline: null });
    await User.updateOne({ _id: firstId }, { $set: { accountStatus: 'SUSPENDED' } });
    const suspendedFeed = await request(app).get('/api/v1/posts').set('Cookie', secondCookie);
    expect(suspendedFeed.body.data.items.map((item: { id: string }) => item.id)).not.toContain(postId);
    await User.updateOne({ _id: firstId }, { $set: { accountStatus: 'ACTIVE' } });
    await Profile.updateOne({ userId: firstId }, { $set: { visibility: 'PUBLIC' } });
  });

  it('finds older visible posts beyond a long run of unavailable posts and bookmarks', async () => {
    const unavailableAuthor = await signup('Unavailable Author');
    await User.updateOne({ _id: unavailableAuthor.id }, { $set: { accountStatus: 'SUSPENDED' } });
    const unavailablePosts = await Post.insertMany(
      Array.from({ length: 60 }, (_, index) => ({
        authorId: unavailableAuthor.id,
        content: `Unavailable update ${index}`,
        status: 'PUBLISHED'
      }))
    );
    await PostBookmark.create({ userId: secondId, postId });
    await PostBookmark.insertMany(unavailablePosts.map((post) => ({ userId: secondId, postId: post._id })));

    const feed = await request(app).get('/api/v1/posts?limit=1').set('Cookie', secondCookie);
    expect(feed.status).toBe(200);
    expect(feed.body.data.items).toHaveLength(1);
    expect(feed.body.data.items[0].author.name).toBe('First Author');

    const saved = await request(app).get('/api/v1/users/me/bookmarks?limit=1').set('Cookie', secondCookie);
    expect(saved.status).toBe(200);
    expect(saved.body.data.items.map((item: { id: string }) => item.id)).toEqual([postId]);

    await PostBookmark.deleteMany({ userId: secondId });
    await Post.deleteMany({ authorId: unavailableAuthor.id });
  });

  it('soft deletes a post, hiding it from feed, saved posts, and interactions', async () => {
    await request(app).put(`/api/v1/posts/${postId}/bookmark`).set('Cookie', secondCookie);
    expect((await request(app).delete(`/api/v1/posts/${postId}`).set('Cookie', secondCookie)).status).toBe(
      404
    );
    expect((await request(app).delete(`/api/v1/posts/${postId}`).set('Cookie', firstCookie)).status).toBe(
      200
    );
    expect(
      (await request(app).get('/api/v1/posts').set('Cookie', firstCookie)).body.data.items.map(
        (item: { id: string }) => item.id
      )
    ).not.toContain(postId);
    expect(
      (await request(app).get('/api/v1/users/me/bookmarks').set('Cookie', secondCookie)).body.data.items
    ).toHaveLength(0);
    expect((await request(app).put(`/api/v1/posts/${postId}/like`).set('Cookie', secondCookie)).status).toBe(
      404
    );
    expect(
      (
        await request(app)
          .post(`/api/v1/posts/${postId}/comments`)
          .set('Cookie', secondCookie)
          .send({ content: 'Nope' })
      ).status
    ).toBe(404);
    expect((await Post.findById(postId))?.status).toBe('DELETED');
  });

  it('requires completed onboarding for feed access', async () => {
    const newer = await request(app)
      .post('/api/v1/auth/signup')
      .send({ name: 'Incomplete', email: 'incomplete-feed@example.test', password: 'password-123' });
    const cookie = String(newer.headers['set-cookie']?.[0]).split(';')[0];
    expect((await request(app).get('/api/v1/posts').set('Cookie', cookie)).body.error.code).toBe(
      'ONBOARDING_REQUIRED'
    );
  });

  it('rate limits repeated write attempts', async () => {
    let limited = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const response = await request(app)
        .post('/api/v1/posts')
        .set('Cookie', firstCookie)
        .send({ content: ' ' });
      if (response.status === 429) {
        limited = true;
        break;
      }
    }
    expect(limited).toBe(true);
  });
});
