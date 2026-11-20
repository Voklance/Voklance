import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../app.js';
import User from '../users/model/User.js';
import Profile from '../profiles/model/Profile.js';
import Post from '../posts/model/Post.js';
import Community from '../communities/model/Community.js';
import CommunityMembership from '../memberships/model/CommunityMembership.js';
import UserBlock from '../messaging/model/UserBlock.js';
import ProfileProject from '../profiles/model/ProfileProject.js';
import ProfileCertification from '../profiles/model/ProfileCertification.js';

let mongo: MongoMemoryServer;
const accounts: { id: string; cookie: string }[] = [];
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([
    User.init(),
    Profile.init(),
    Post.init(),
    Community.init(),
    CommunityMembership.init(),
    UserBlock.init(),
    ProfileProject.init(),
    ProfileCertification.init()
  ]);
  for (let index = 0; index < 2; index++) {
    const result = await request(app)
      .post('/api/v1/auth/signup')
      .send({ name: `Search User ${index}`, email: `search${index}@example.test`, password: 'password-123' });
    accounts.push({
      id: result.body.data.user.id,
      cookie: String(result.headers['set-cookie']?.[0]).split(';')[0]
    });
    await User.updateOne({ _id: accounts[index].id }, { $set: { onboardingStatus: 'COMPLETED' } });
  }
  await Profile.create({
    userId: accounts[1].id,
    username: 'react-engineer',
    fullName: 'React Engineer',
    headline: 'Frontend developer',
    country: 'India',
    visibility: 'PUBLIC'
  });
  await Post.create({
    authorId: accounts[1].id,
    content: 'Sharing React patterns for accessible interfaces',
    status: 'PUBLISHED'
  });
  await Community.create({
    name: 'Private React Guild',
    slug: 'private-react-guild',
    description: 'React discussions for approved members',
    category: 'software-development',
    tags: ['react'],
    ownerId: accounts[1].id,
    visibility: 'PRIVATE',
    status: 'ACTIVE',
    rules: ''
  });
}, 120_000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
const auth = () => ({ Cookie: accounts[0].cookie });
describe('unified search', () => {
  it('returns safe public results and hides private communities until membership is active', async () => {
    const all = await request(app).get('/api/v1/search?q=React').set(auth());
    expect(all.status).toBe(200);
    expect(all.body.data.previews.people).toHaveLength(1);
    expect(all.body.data.previews.posts).toHaveLength(1);
    expect(all.body.data.previews.communities).toHaveLength(0);
    expect(JSON.stringify(all.body.data)).not.toContain('search1@example.test');
    const community = await Community.findOne({ slug: 'private-react-guild' }).lean();
    await CommunityMembership.create({
      communityId: community!._id,
      userId: accounts[0].id,
      role: 'MEMBER',
      status: 'ACTIVE'
    });
    const joined = await request(app).get('/api/v1/search?q=React&category=communities').set(auth());
    expect(joined.body.data.items).toHaveLength(1);
    expect(joined.body.data.items[0].href).toBe('/app/communities/private-react-guild');
  });
  it('excludes blocked authors and rejects unsafe query inputs', async () => {
    await UserBlock.create({ blockerId: accounts[0].id, blockedId: accounts[1].id });
    const results = await request(app).get('/api/v1/search?q=React&category=posts').set(auth());
    expect(results.body.data.items).toHaveLength(0);
    expect((await request(app).get('/api/v1/search?q=a').set(auth())).status).toBe(400);
    expect((await request(app).get('/api/v1/search?q=React&category=messages').set(auth())).status).toBe(400);
  });
});
