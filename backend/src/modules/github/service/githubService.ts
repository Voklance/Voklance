import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { Types } from 'mongoose';
import type { GitHubConnectionDto, GitHubRepositoryDto, GitHubRepositoryPage } from '@voklance/shared';
import { AppError } from '../../../common/AppError.js';
import { env } from '../../../config/env.js';
import Profile from '../../profiles/model/Profile.js';
import User from '../../users/model/User.js';
import GitHubOAuthState from '../model/GitHubOAuthState.js';
import GitHubConnection from '../model/GitHubConnection.js';
import GitHubRepository, { type GitHubRepositoryRecord } from '../model/GitHubRepository.js';
const oid = (id: string) => new Types.ObjectId(id);
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const safeName = /^[A-Za-z0-9-]{1,39}$/;
const identitySchema = z
  .object({
    id: z.number().int().positive(),
    login: z.string().regex(safeName),
    html_url: z.url(),
    avatar_url: z.url().nullable().optional(),
    type: z.string().optional()
  })
  .passthrough();
const repoSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string().min(1).max(200),
    full_name: z.string().min(1).max(400),
    html_url: z.url(),
    description: z.string().max(2000).nullable(),
    language: z.string().max(100).nullable(),
    topics: z.array(z.string().max(100)).max(50).default([]),
    stargazers_count: z.number().int().min(0),
    forks_count: z.number().int().min(0),
    watchers_count: z.number().int().min(0),
    fork: z.boolean(),
    archived: z.boolean(),
    private: z.boolean(),
    pushed_at: z.iso.datetime().nullable(),
    updated_at: z.iso.datetime(),
    owner: z.object({ id: z.number().int().positive(), login: z.string().regex(safeName) }).passthrough()
  })
  .passthrough();
type StoredRepo = GitHubRepositoryRecord & { _id: Types.ObjectId };
function safeGitHubUrl(value: string, kind: 'profile' | 'repo' | 'avatar') {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    (kind === 'avatar'
      ? !['avatars.githubusercontent.com', 'github.com'].includes(url.hostname)
      : url.hostname !== 'github.com')
  )
    throw new AppError(502, 'GITHUB_RESPONSE_INVALID', 'GitHub returned an unexpected URL.');
  return url.toString();
}
function settings() {
  if (!env.githubClientId || !env.githubClientSecret || !env.githubOAuthCallbackUrl)
    throw new AppError(503, 'GITHUB_NOT_CONFIGURED', 'GitHub connection is not configured.');
  return {
    clientId: env.githubClientId,
    clientSecret: env.githubClientSecret,
    callbackUrl: env.githubOAuthCallbackUrl
  };
}
async function githubJson(path: string, token?: string) {
  const url = new URL(path, `${env.githubApiBaseUrl.replace(/\/$/, '')}/`);
  if (url.origin !== new URL(env.githubApiBaseUrl).origin)
    throw new AppError(502, 'GITHUB_RESPONSE_INVALID', 'GitHub request was rejected.');
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Voklance',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      signal: AbortSignal.timeout(10_000),
      redirect: 'error'
    });
  } catch {
    throw new AppError(503, 'GITHUB_UNAVAILABLE', 'GitHub is temporarily unavailable.');
  }
  if (response.status === 403 || response.status === 429)
    throw new AppError(503, 'GITHUB_RATE_LIMITED', 'GitHub rate limit reached. Try again later.');
  if (!response.ok) throw new AppError(502, 'GITHUB_UNAVAILABLE', 'GitHub could not complete the request.');
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new AppError(502, 'GITHUB_RESPONSE_INVALID', 'GitHub returned an invalid response.');
  }
}
export async function beginGitHubConnection(userId: string, sessionToken: string | undefined) {
  const { clientId, callbackUrl } = settings();
  if (!sessionToken) throw new AppError(401, 'UNAUTHENTICATED', 'Sign in first.');
  const state = randomBytes(32).toString('base64url');
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  await GitHubOAuthState.create({
    userId: oid(userId),
    sessionHash: hash(sessionToken),
    stateHash: hash(state),
    codeVerifier: verifier,
    expiresAt: new Date(Date.now() + 10 * 60_000)
  });
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', callbackUrl);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', 'read:user');
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return { authorizationUrl: url.toString() };
}
export async function completeGitHubConnection(
  userId: string,
  sessionToken: string | undefined,
  state: string,
  code: string
) {
  const { clientId, clientSecret, callbackUrl } = settings();
  if (!sessionToken || !/^[A-Za-z0-9_-]{30,100}$/.test(state) || !/^[A-Za-z0-9_-]{5,200}$/.test(code))
    throw new AppError(400, 'GITHUB_OAUTH_INVALID', 'GitHub connection could not be verified.');
  const saved = await GitHubOAuthState.findOneAndDelete({
    userId: oid(userId),
    sessionHash: hash(sessionToken),
    stateHash: hash(state),
    expiresAt: { $gt: new Date() }
  });
  if (!saved) throw new AppError(400, 'GITHUB_OAUTH_INVALID', 'GitHub connection could not be verified.');
  let response: Response;
  try {
    response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Voklance'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: callbackUrl,
        code_verifier: saved.codeVerifier
      }).toString(),
      signal: AbortSignal.timeout(10_000),
      redirect: 'error'
    });
  } catch {
    throw new AppError(503, 'GITHUB_UNAVAILABLE', 'GitHub is temporarily unavailable.');
  }
  if (!response.ok) throw new AppError(502, 'GITHUB_OAUTH_FAILED', 'GitHub connection failed.');
  const tokenData = z
    .object({
      access_token: z.string().min(1),
      token_type: z.string(),
      error: z.string().optional()
    })
    .passthrough()
    .safeParse(await response.json().catch(() => null));
  if (!tokenData.success || tokenData.data.error || tokenData.data.token_type.toLowerCase() !== 'bearer')
    throw new AppError(502, 'GITHUB_OAUTH_FAILED', 'GitHub connection failed.');
  const identity = identitySchema.parse(await githubJson('/user', tokenData.data.access_token));
  // The connection uses public repositories only. Revoke the one-time OAuth grant
  // before persisting identity; no GitHub credential is retained in our database.
  let revoked: Response;
  try {
    revoked = await fetch(
      `${env.githubApiBaseUrl.replace(/\/$/, '')}/applications/${encodeURIComponent(clientId)}/grant`,
      {
        method: 'DELETE',
        headers: {
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          'User-Agent': 'Voklance'
        },
        body: JSON.stringify({ access_token: tokenData.data.access_token }),
        signal: AbortSignal.timeout(10_000),
        redirect: 'error'
      }
    );
  } catch {
    throw new AppError(503, 'GITHUB_REVOKE_FAILED', 'GitHub connection could not be secured. Try again.');
  }
  if (revoked.status !== 204)
    throw new AppError(502, 'GITHUB_REVOKE_FAILED', 'GitHub connection could not be secured. Try again.');
  if (identity.type && identity.type !== 'User')
    throw new AppError(400, 'GITHUB_ACCOUNT_INVALID', 'Connect a personal GitHub account.');
  const githubUserId = String(identity.id);
  const existing = await GitHubConnection.findOne({ userId: oid(userId) }).lean();
  if (existing && existing.githubUserId !== githubUserId)
    throw new AppError(409, 'GITHUB_ALREADY_CONNECTED', 'Disconnect your current GitHub account first.');
  const owner = await GitHubConnection.findOne({ githubUserId }).select('userId').lean();
  if (owner && owner.userId.toString() !== userId)
    throw new AppError(409, 'GITHUB_ACCOUNT_IN_USE', 'This GitHub account is connected elsewhere.');
  try {
    await GitHubConnection.updateOne(
      { userId: oid(userId) },
      {
        $set: {
          githubUserId,
          githubUsername: identity.login,
          githubProfileUrl: safeGitHubUrl(identity.html_url, 'profile'),
          githubAvatarUrl: identity.avatar_url ? safeGitHubUrl(identity.avatar_url, 'avatar') : null
        },
        $setOnInsert: { connectedAt: new Date(), syncStatus: 'never', featuredRepositoryIds: [] }
      },
      { upsert: true, runValidators: true }
    );
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000)
      throw new AppError(409, 'GITHUB_ACCOUNT_IN_USE', 'This GitHub account is connected elsewhere.');
    throw error;
  }
  return connectionStatus(userId);
}
export async function connectionStatus(userId: string): Promise<GitHubConnectionDto> {
  const record = await GitHubConnection.findOne({ userId: oid(userId) }).lean();
  if (!record) return { connected: false };
  return {
    connected: true,
    username: record.githubUsername,
    profileUrl: record.githubProfileUrl,
    avatarUrl: record.githubAvatarUrl ?? null,
    connectedAt: record.connectedAt.toISOString(),
    lastSyncedAt: record.lastSyncedAt?.toISOString() ?? null,
    syncStatus: record.syncStatus,
    repositoryCount: await GitHubRepository.countDocuments({ userId: oid(userId), isUnavailable: false })
  };
}
export async function disconnectGitHub(userId: string) {
  const record = await GitHubConnection.findOneAndDelete({ userId: oid(userId) });
  if (record) await GitHubRepository.deleteMany({ githubConnectionId: record._id });
  return { connected: false };
}
export function toRepository(record: StoredRepo, featured: string[]): GitHubRepositoryDto {
  const order = featured.indexOf(record._id.toString());
  return {
    id: record._id.toString(),
    githubRepositoryId: record.githubRepositoryId,
    name: record.name,
    fullName: record.fullName,
    description: record.description ?? null,
    htmlUrl: record.htmlUrl,
    primaryLanguage: record.primaryLanguage ?? null,
    topics: record.topics,
    stargazersCount: record.stargazersCount,
    forksCount: record.forksCount,
    watchersCount: record.watchersCount,
    isFork: record.isFork,
    isArchived: record.isArchived,
    pushedAt: record.pushedAt?.toISOString() ?? null,
    githubUpdatedAt: record.githubUpdatedAt.toISOString(),
    featuredOrder: order >= 0 ? order : null,
    lastSyncedAt: record.lastSyncedAt.toISOString()
  };
}
export async function syncGitHub(userId: string) {
  const connection = await GitHubConnection.findOne({ userId: oid(userId) }).lean();
  if (!connection) throw new AppError(404, 'GITHUB_NOT_CONNECTED', 'Connect GitHub first.');
  const now = new Date();
  if (
    connection.lastSyncedAt &&
    now.getTime() - connection.lastSyncedAt.getTime() < env.githubSyncCooldownMinutes * 60_000
  )
    throw new AppError(429, 'GITHUB_SYNC_COOLDOWN', 'Please wait before syncing again.');
  const locked = await GitHubConnection.findOneAndUpdate(
    {
      _id: connection._id,
      $or: [
        { syncStatus: { $ne: 'syncing' } },
        { syncStartedAt: { $lt: new Date(now.getTime() - 10 * 60_000) } }
      ]
    },
    { $set: { syncStatus: 'syncing', syncStartedAt: now } },
    { new: true }
  );
  if (!locked) throw new AppError(409, 'GITHUB_SYNC_RUNNING', 'GitHub sync is already running.');
  try {
    const identity = identitySchema.parse(await githubJson(`/user/${connection.githubUserId}`));
    if (String(identity.id) !== connection.githubUserId)
      throw new AppError(502, 'GITHUB_IDENTITY_CHANGED', 'GitHub identity could not be verified.');
    const imported: z.infer<typeof repoSchema>[] = [];
    let complete = false;
    for (let page = 1; page <= 5; page++) {
      const raw = await githubJson(
        `/users/${encodeURIComponent(identity.login)}/repos?type=owner&per_page=100&page=${page}`
      );
      const parsed = z.array(repoSchema).max(100).parse(raw);
      imported.push(...parsed.filter((repo) => !repo.private && repo.owner.id === identity.id));
      if (parsed.length < 100) {
        complete = true;
        break;
      }
    }
    const syncedAt = new Date();
    const operations = imported.map((repo) => ({
      updateOne: {
        filter: { userId: oid(userId), githubRepositoryId: String(repo.id) },
        update: {
          $set: {
            userId: oid(userId),
            githubConnectionId: connection._id,
            githubRepositoryId: String(repo.id),
            ownerLogin: repo.owner.login,
            name: repo.name,
            fullName: repo.full_name,
            description: repo.description,
            htmlUrl: safeGitHubUrl(repo.html_url, 'repo'),
            primaryLanguage: repo.language,
            topics: repo.topics,
            stargazersCount: repo.stargazers_count,
            forksCount: repo.forks_count,
            watchersCount: repo.watchers_count,
            isFork: repo.fork,
            isArchived: repo.archived,
            isUnavailable: false,
            pushedAt: repo.pushed_at ? new Date(repo.pushed_at) : null,
            githubUpdatedAt: new Date(repo.updated_at),
            lastSyncedAt: syncedAt
          }
        },
        upsert: true
      }
    }));
    if (operations.length) await GitHubRepository.bulkWrite(operations, { ordered: false });
    if (complete)
      await GitHubRepository.updateMany(
        {
          githubConnectionId: connection._id,
          githubRepositoryId: { $nin: imported.map((repo) => String(repo.id)) }
        },
        { $set: { isUnavailable: true } }
      );
    await GitHubConnection.updateOne(
      { _id: connection._id },
      {
        $set: {
          githubUsername: identity.login,
          githubProfileUrl: safeGitHubUrl(identity.html_url, 'profile'),
          githubAvatarUrl: identity.avatar_url ? safeGitHubUrl(identity.avatar_url, 'avatar') : null,
          syncStatus: complete ? 'success' : 'partial',
          lastSyncedAt: syncedAt,
          syncStartedAt: null
        }
      }
    );
    return {
      syncStatus: complete ? ('success' as const) : ('partial' as const),
      importedCount: imported.length,
      lastSyncedAt: syncedAt.toISOString()
    };
  } catch (error) {
    await GitHubConnection.updateOne(
      { _id: connection._id },
      { $set: { syncStatus: 'error', syncStartedAt: null } }
    );
    if (error instanceof AppError) throw error;
    throw new AppError(502, 'GITHUB_SYNC_FAILED', 'GitHub sync failed. Try again later.');
  }
}
export async function listRepositories(
  userId: string,
  query: {
    search?: string;
    language?: string;
    sort: 'recently_updated' | 'most_starred' | 'name';
    limit: number;
    cursor?: string;
  }
): Promise<GitHubRepositoryPage> {
  const connection = await GitHubConnection.findOne({ userId: oid(userId) }).lean();
  if (!connection) throw new AppError(404, 'GITHUB_NOT_CONNECTED', 'Connect GitHub first.');
  const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sort: Record<string, 1 | -1> =
    query.sort === 'most_starred'
      ? { stargazersCount: -1 as const, _id: -1 as const }
      : query.sort === 'name'
        ? { name: 1 as const, _id: -1 as const }
        : { githubUpdatedAt: -1 as const, _id: -1 as const };
  const offset = query.cursor ? Number(Buffer.from(query.cursor, 'base64url').toString()) : 0;
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000)
    throw new AppError(400, 'INVALID_CURSOR', 'Invalid page cursor.');
  const rows = await GitHubRepository.find({
    userId: oid(userId),
    isUnavailable: false,
    ...(query.search
      ? {
          $or: [
            { name: { $regex: escaped(query.search), $options: 'i' } },
            { description: { $regex: escaped(query.search), $options: 'i' } }
          ]
        }
      : {}),
    ...(query.language ? { primaryLanguage: query.language } : {})
  })
    .sort(sort)
    .skip(offset)
    .limit(query.limit + 1)
    .lean();
  const hasMore = rows.length > query.limit;
  return {
    items: rows
      .slice(0, query.limit)
      .map((row) => toRepository(row, connection.featuredRepositoryIds.map(String))),
    hasMore,
    nextCursor: hasMore ? Buffer.from(String(offset + query.limit)).toString('base64url') : null
  };
}
export async function setFeatured(userId: string, ids: string[]) {
  const connection = await GitHubConnection.findOne({ userId: oid(userId) });
  if (!connection) throw new AppError(404, 'GITHUB_NOT_CONNECTED', 'Connect GitHub first.');
  const count = await GitHubRepository.countDocuments({
    _id: { $in: ids.map(oid) },
    userId: oid(userId),
    isUnavailable: false
  });
  if (count !== ids.length)
    throw new AppError(400, 'GITHUB_REPOSITORY_INVALID', 'Select only your imported public repositories.');
  connection.featuredRepositoryIds = ids.map(oid);
  await connection.save();
  return portfolioForUser(userId);
}
export async function portfolioForUser(userId: string) {
  const connection = await GitHubConnection.findOne({ userId: oid(userId) }).lean();
  if (!connection) return { connected: false, repositories: [] as GitHubRepositoryDto[] };
  const featured = connection.featuredRepositoryIds.map(String);
  const rows = await GitHubRepository.find({
    _id: { $in: connection.featuredRepositoryIds },
    userId: oid(userId),
    isUnavailable: false
  }).lean();
  const map = new Map(rows.map((row) => [row._id.toString(), row]));
  return {
    connected: true,
    username: connection.githubUsername,
    profileUrl: connection.githubProfileUrl,
    repositories: featured.flatMap((id) => {
      const row = map.get(id);
      return row ? [toRepository(row, featured)] : [];
    })
  };
}
export async function publicPortfolio(username: string) {
  const profile = await Profile.findOne({ username, visibility: 'PUBLIC' }).select('userId').lean();
  if (!profile) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile unavailable.');
  const user = await User.findOne({
    _id: profile.userId,
    onboardingStatus: 'COMPLETED',
    $or: [{ accountStatus: 'ACTIVE' }, { accountStatus: { $exists: false } }]
  })
    .select('_id')
    .lean();
  if (!user) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile unavailable.');
  return portfolioForUser(user._id.toString());
}
