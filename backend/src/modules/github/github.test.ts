import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../../app.js';
import { env } from '../../config/env.js';
import User from '../users/model/User.js';
import Profile from '../profiles/model/Profile.js';
import GitHubOAuthState from './model/GitHubOAuthState.js';
import GitHubConnection from './model/GitHubConnection.js';
import GitHubRepository from './model/GitHubRepository.js';
let mongo: MongoMemoryServer;
const accounts: { id: string; cookie: string }[] = [];
const identity = {
  id: 42,
  login: 'dev-user',
  html_url: 'https://github.com/dev-user',
  avatar_url: 'https://avatars.githubusercontent.com/u/42',
  type: 'User'
};
const repo = {
  id: 100,
  name: 'sample',
  full_name: 'dev-user/sample',
  html_url: 'https://github.com/dev-user/sample',
  description: 'A public project',
  language: 'TypeScript',
  topics: ['typescript'],
  stargazers_count: 5,
  forks_count: 2,
  watchers_count: 5,
  fork: false,
  archived: false,
  private: false,
  pushed_at: '2026-11-01T00:00:00Z',
  updated_at: '2026-11-02T00:00:00Z',
  owner: { id: 42, login: 'dev-user' }
};
const auth = (index: number) => ({ Cookie: accounts[index].cookie });
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([
    User.init(),
    Profile.init(),
    GitHubOAuthState.init(),
    GitHubConnection.init(),
    GitHubRepository.init()
  ]);
  for (let i = 0; i < 2; i++) {
    const result = await request(app)
      .post('/api/v1/auth/signup')
      .send({ name: `GitHub User ${i}`, email: `github${i}@example.test`, password: 'password-123' });
    accounts.push({
      id: result.body.data.user.id,
      cookie: String(result.headers['set-cookie']?.[0]).split(';')[0]
    });
    await User.updateOne({ _id: accounts[i].id }, { $set: { onboardingStatus: 'COMPLETED' } });
    await Profile.create({
      userId: accounts[i].id,
      username: `github-user-${i}`,
      fullName: `GitHub User ${i}`,
      headline: 'Developer',
      country: 'India',
      visibility: 'PUBLIC'
    });
  }
}, 120_000);
beforeEach(async () => {
  await Promise.all([
    GitHubOAuthState.deleteMany({}),
    GitHubConnection.deleteMany({}),
    GitHubRepository.deleteMany({})
  ]);
  env.githubClientId = 'test-client';
  env.githubClientSecret = 'test-secret';
  env.githubOAuthCallbackUrl = 'http://localhost:5001/api/v1/github/callback';
  env.githubApiBaseUrl = 'https://api.github.com';
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: URL | string) => {
      const url = String(input);
      if (url.includes('/login/oauth/access_token'))
        return new Response(JSON.stringify({ access_token: 'temporary-token', token_type: 'bearer' }), {
          status: 200
        });
      if (url.includes('/applications/test-client/grant')) return new Response(null, { status: 204 });
      if (url.endsWith('/user') || url.endsWith('/user/42'))
        return new Response(JSON.stringify(identity), { status: 200 });
      if (url.includes('/repos?'))
        return new Response(
          JSON.stringify([
            repo,
            { ...repo, id: 101, name: 'private', full_name: 'dev-user/private', private: true }
          ]),
          { status: 200 }
        );
      return new Response('{}', { status: 404 });
    })
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  env.githubClientId = undefined;
  env.githubClientSecret = undefined;
  env.githubOAuthCallbackUrl = undefined;
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
async function connect(index: number) {
  const start = await request(app).get('/api/v1/github/connect').set(auth(index));
  expect(start.status).toBe(200);
  const url = new URL(start.body.data.authorizationUrl);
  expect(url.hostname).toBe('github.com');
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  const state = url.searchParams.get('state')!;
  const callback = await request(app)
    .get(`/api/v1/github/callback?code=valid-code&state=${state}`)
    .set(auth(index));
  expect(callback.status).toBe(303);
  expect(callback.headers.location).toContain('github=connected');
  return state;
}
describe('GitHub public portfolio', () => {
  it('binds single-use OAuth state to a Voklance session and stores no token', async () => {
    const start = await request(app).get('/api/v1/github/connect').set(auth(0));
    const state = new URL(start.body.data.authorizationUrl).searchParams.get('state')!;
    const wrong = await request(app)
      .get(`/api/v1/github/callback?code=valid-code&state=${state}`)
      .set(auth(1));
    expect(wrong.headers.location).toContain('github=error');
    const correct = await request(app)
      .get(`/api/v1/github/callback?code=valid-code&state=${state}`)
      .set(auth(0));
    expect(correct.headers.location).toContain('github=connected');
    const replay = await request(app)
      .get(`/api/v1/github/callback?code=valid-code&state=${state}`)
      .set(auth(0));
    expect(replay.headers.location).toContain('github=error');
    const stored = await GitHubConnection.findOne({ userId: accounts[0].id }).lean();
    expect(stored?.githubUserId).toBe('42');
    expect(JSON.stringify(stored)).not.toContain('temporary-token');
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(([url, options]) => String(url).includes('/grant') && options?.method === 'DELETE')
    ).toBe(true);
    const second = await request(app).get('/api/v1/github/connect').set(auth(1));
    const secondState = new URL(second.body.data.authorizationUrl).searchParams.get('state')!;
    const duplicate = await request(app)
      .get(`/api/v1/github/callback?code=valid-code&state=${secondState}`)
      .set(auth(1));
    expect(duplicate.headers.location).toContain('github=error');
  });
  it('imports only owned public repositories, features one, and enforces cooldown', async () => {
    await connect(0);
    const synced = await request(app).post('/api/v1/github/sync').set(auth(0));
    expect(synced.status).toBe(200);
    expect(synced.body.data.importedCount).toBe(1);
    expect(await GitHubRepository.countDocuments()).toBe(1);
    const repositories = await request(app).get('/api/v1/github/repositories?sort=most_starred').set(auth(0));
    expect(repositories.body.data.items).toHaveLength(1);
    const id = repositories.body.data.items[0].id;
    expect(
      (
        await request(app)
          .put('/api/v1/github/featured')
          .set(auth(0))
          .send({ repositoryIds: [id] })
      ).status
    ).toBe(200);
    const publicResult = await request(app).get('/api/v1/github/portfolio/github-user-0').set(auth(1));
    expect(publicResult.body.data.repositories[0].name).toBe('sample');
    expect(
      (await request(app).get('/api/v1/github/portfolio/github-user-0')).body.data.repositories[0].name
    ).toBe('sample');
    expect((await request(app).post('/api/v1/github/sync').set(auth(0))).status).toBe(429);
    expect((await request(app).delete('/api/v1/github/connection').set(auth(0))).status).toBe(200);
    expect(await GitHubRepository.countDocuments()).toBe(0);
  });
  it('keeps GitHub routes gated when credentials are unavailable', async () => {
    env.githubClientId = undefined;
    env.githubClientSecret = undefined;
    env.githubOAuthCallbackUrl = undefined;
    expect((await request(app).get('/api/v1/github/connect').set(auth(0))).status).toBe(503);
  });
});
