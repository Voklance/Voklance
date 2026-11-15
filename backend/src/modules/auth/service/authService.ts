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

export const sessionCookieName = 'voklance_session';
export const sessionAgeMs = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string) {
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

async function issueSession(user: AccountRecord) {
  const token = randomBytes(32).toString('hex');
  await Session.create({
    userId: user._id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + sessionAgeMs)
  });
  return { user: toAuthUser(user), token };
}

export async function register(input: SignupInput) {
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
  const session = await issueSession(user);
  const verificationEmailSent = env.emailVerificationEnabled
    ? await issueVerificationEmail(user).catch(() => false)
    : false;
  return { ...session, verificationEmailSent };
}

export async function authenticate(input: LoginInput) {
  const user = await User.findOne({ email: input.email }).select('+passwordHash');
  const valid = await verifyPassword(input.password, user?.passwordHash ?? dummyPasswordHash);
  if (!user || !valid) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  assertActive(user);
  return issueSession(user);
}

export async function getCurrentUser(token: string | undefined) {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) throw new AppError(401, 'UNAUTHENTICATED', 'Not signed in.');
  const session = await Session.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
  if (!session) throw new AppError(401, 'SESSION_EXPIRED', 'Session expired. Please sign in again.');
  const user = await User.findById(session.userId);
  if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Not signed in.');
  assertActive(user);
  return toAuthUser(user);
}

export async function revokeSession(token: string | undefined) {
  if (token && /^[0-9a-f]{64}$/.test(token)) await Session.deleteOne({ tokenHash: hashToken(token) });
}
