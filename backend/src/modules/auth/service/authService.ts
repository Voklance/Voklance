import { createHash, randomBytes } from 'node:crypto';
import type { AuthUser } from '@voklance/shared';
import type { Types } from 'mongoose';
import { AppError } from '../../../common/AppError.js';
import Session from '../model/Session.js';
import User, { type UserRecord } from '../../users/model/User.js';
import { dummyPasswordHash, hashPassword, verifyPassword } from './passwordService.js';
import type { LoginInput, SignupInput } from '../validation/authSchemas.js';
import { issueVerificationEmail } from './emailVerificationService.js';
import { env } from '../../../config/env.js';
import { auditSecurityEvent } from '../../settings/service/securityAudit.js';

export const sessionCookieName = 'voklance_session';
export const sessionAgeMs = 7 * 24 * 60 * 60 * 1000;

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

type AccountRecord = UserRecord & { _id: Types.ObjectId };

function toAuthUser(user: AccountRecord): AuthUser {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    accountStatus: user.accountStatus ?? 'ACTIVE',
    onboardingStatus: user.onboardingStatus ?? 'NOT_STARTED',
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    emailVerificationRequired: env.emailVerificationEnabled && user.emailVerificationRequired === true
  };
}

function assertActive(user: AccountRecord) {
  if (user.accountStatus === 'SUSPENDED')
    throw new AppError(403, 'ACCOUNT_SUSPENDED', 'This account is unavailable.');
  if (user.accountStatus === 'DEACTIVATED')
    throw new AppError(403, 'ACCOUNT_DEACTIVATED', 'This account is unavailable.');
  if (user.accountStatus && user.accountStatus !== 'ACTIVE')
    throw new AppError(403, 'ACCOUNT_UNAVAILABLE', 'This account is unavailable.');
}

function userAgentSummary(userAgent?: string) {
  const agent = (userAgent ?? '').slice(0, 500);
  const browser = /Firefox/i.test(agent)
    ? 'Firefox'
    : /Edg\//i.test(agent)
      ? 'Edge'
      : /Chrome/i.test(agent)
        ? 'Chrome'
        : /Safari/i.test(agent)
          ? 'Safari'
          : 'Unknown browser';
  const device = /Android/i.test(agent)
    ? 'Android'
    : /iPhone|iPad/i.test(agent)
      ? 'iOS'
      : /Windows/i.test(agent)
        ? 'Windows'
        : /Macintosh|Mac OS/i.test(agent)
          ? 'macOS'
          : /Linux/i.test(agent)
            ? 'Linux'
            : 'Unknown device';
  return `${browser} on ${device}`;
}
async function issueSession(user: AccountRecord, userAgent?: string) {
  const token = randomBytes(32).toString('hex');
  await Session.create({
    userId: user._id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + sessionAgeMs),
    sessionVersion: user.sessionVersion ?? 0,
    lastSeenAt: new Date(),
    userAgentSummary: userAgentSummary(userAgent)
  });
  return { user: toAuthUser(user), token };
}

export async function register(input: SignupInput, userAgent?: string) {
  let user: AccountRecord;
  try {
    user = await User.create({
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      emailVerificationRequired: env.emailVerificationEnabled,
      emailVerifiedAt: null
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists.');
    }
    throw error;
  }
  const session = await issueSession(user, userAgent);
  const verificationEmailSent = env.emailVerificationEnabled
    ? await issueVerificationEmail(user).catch(() => false)
    : false;
  return { ...session, verificationEmailSent };
}

export async function authenticate(input: LoginInput, userAgent?: string) {
  const user = await User.findOne({ email: input.email }).select('+passwordHash');
  const valid = await verifyPassword(input.password, user?.passwordHash ?? dummyPasswordHash);
  if (!user || !valid) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  assertActive(user);
  return issueSession(user, userAgent);
}

export async function getCurrentUser(token: string | undefined) {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) throw new AppError(401, 'UNAUTHENTICATED', 'Not signed in.');
  const session = await Session.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
  if (!session) throw new AppError(401, 'SESSION_EXPIRED', 'Session expired. Please sign in again.');
  const user = await User.findById(session.userId);
  if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Not signed in.');
  if ((session.sessionVersion ?? 0) !== (user.sessionVersion ?? 0))
    throw new AppError(401, 'SESSION_EXPIRED', 'Session expired. Please sign in again.');
  assertActive(user);
  if (!session.lastSeenAt || Date.now() - session.lastSeenAt.getTime() > 15 * 60_000)
    void Session.updateOne({ _id: session._id }, { $set: { lastSeenAt: new Date() } }).catch(() => undefined);
  return toAuthUser(user);
}

export async function reactivate(input: LoginInput, userAgent?: string) {
  const user = await User.findOne({ email: input.email }).select('+passwordHash');
  const valid = await verifyPassword(input.password, user?.passwordHash ?? dummyPasswordHash);
  if (!user || !valid || user.accountStatus !== 'DEACTIVATED')
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  const changed = await User.updateOne(
    { _id: user._id, accountStatus: 'DEACTIVATED' },
    { $set: { accountStatus: 'ACTIVE' } }
  );
  if (changed.modifiedCount !== 1)
    throw new AppError(409, 'ACCOUNT_REACTIVATION_CONFLICT', 'Try reactivation again.');
  user.accountStatus = 'ACTIVE';
  auditSecurityEvent(user._id.toString(), 'account_reactivated');
  return issueSession(user, userAgent);
}

export async function revokeSession(token: string | undefined) {
  if (token && /^[0-9a-f]{64}$/.test(token)) await Session.deleteOne({ tokenHash: hashToken(token) });
}
