import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../app.js';
import User from '../users/model/User.js';
import Profile from './model/Profile.js';
import ProfileRating from './model/ProfileRating.js';

let mongo: MongoMemoryServer;
let targetCookie = '';
let firstCookie = '';
let secondCookie = '';

async function account(name: string, email: string) {
  const signup = await request(app)
    .post('/api/v1/auth/signup')
    .send({ name, email, password: 'password-123' });
  expect(signup.status).toBe(201);
  await User.updateOne({ _id: signup.body.data.user.id }, { $set: { onboardingStatus: 'COMPLETED' } });
  return String(signup.headers['set-cookie']?.[0]).split(';')[0];
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), Profile.init(), ProfileRating.init()]);
  targetCookie = await account('Target Professional', 'target@example.test');
  firstCookie = await account('First Reviewer', 'first@example.test');
  secondCookie = await account('Second Reviewer', 'second@example.test');
  const created = await request(app).patch('/api/v1/profiles/me').set('Cookie', targetCookie).send({
    username: 'target-pro',
    fullName: 'Target Professional',
    headline: 'Engineer',
    country: 'India',
    visibility: 'PUBLIC'
  });
  expect(created.status).toBe(200);
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

describe('profile ratings', () => {
  it('starts empty and rejects unauthenticated, invalid, and self ratings', async () => {
    expect((await request(app).get('/api/v1/profiles/public/target-pro')).body.data.rating).toEqual({
      average: null,
      count: 0
    });
    expect(
      (await request(app).get('/api/v1/profiles/me/rating').set('Cookie', targetCookie)).body.data
    ).toEqual({ average: null, count: 0 });
    expect(
      (await request(app).put('/api/v1/profiles/public/target-pro/rating').send({ stars: 5 })).status
    ).toBe(401);
    expect(
      (
        await request(app)
          .put('/api/v1/profiles/public/target-pro/rating')
          .set('Cookie', firstCookie)
          .send({ stars: 0 })
      ).status
    ).toBe(400);
    expect(
      (
        await request(app)
          .put('/api/v1/profiles/public/target-pro/rating')
          .set('Cookie', firstCookie)
          .send({ stars: 3.5 })
      ).status
    ).toBe(400);
    const own = await request(app)
      .put('/api/v1/profiles/public/target-pro/rating')
      .set('Cookie', targetCookie)
      .send({ stars: 5 });
    expect(own.status).toBe(403);
    expect(await ProfileRating.countDocuments()).toBe(0);
  });

  it('calculates the average and updates an existing reviewer rating', async () => {
    const first = await request(app)
      .put('/api/v1/profiles/public/target-pro/rating')
      .set('Cookie', firstCookie)
      .send({ stars: 5 });
    expect(first.body.data).toEqual({ average: 5, count: 1, myRating: 5 });
    const second = await request(app)
      .put('/api/v1/profiles/public/target-pro/rating')
      .set('Cookie', secondCookie)
      .send({ stars: 3 });
    expect(second.body.data).toEqual({ average: 4, count: 2, myRating: 3 });
    expect((await request(app).get('/api/v1/profiles/public/target-pro')).body.data.rating).toEqual({
      average: 4,
      count: 2
    });
    expect(
      (await request(app).get('/api/v1/profiles/me/rating').set('Cookie', targetCookie)).body.data
    ).toEqual({ average: 4, count: 2 });
    expect(
      (await request(app).get('/api/v1/profiles/public/target-pro/rating').set('Cookie', firstCookie)).body
        .data.myRating
    ).toBe(5);
    const changed = await request(app)
      .put('/api/v1/profiles/public/target-pro/rating')
      .set('Cookie', firstCookie)
      .send({ stars: 1 });
    expect(changed.body.data).toEqual({ average: 2, count: 2, myRating: 1 });
    expect(await ProfileRating.countDocuments()).toBe(2);
  });

  it('does not expose or accept ratings for a private profile', async () => {
    await Profile.updateOne({ username: 'target-pro' }, { $set: { visibility: 'PRIVATE' } });
    expect(
      (await request(app).get('/api/v1/profiles/public/target-pro/rating').set('Cookie', firstCookie)).status
    ).toBe(404);
    expect(
      (
        await request(app)
          .put('/api/v1/profiles/public/target-pro/rating')
          .set('Cookie', firstCookie)
          .send({ stars: 5 })
      ).status
    ).toBe(404);
  });
});
