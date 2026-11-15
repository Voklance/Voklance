import { createHash, randomBytes } from 'node:crypto';
import { Types } from 'mongoose';
import { AppError } from '../../../common/AppError.js';
import { env } from '../../../config/env.js';
import { sendVerificationEmail } from '../../../services/email/emailService.js';
import User from '../../users/model/User.js';
import EmailVerificationThrottle from '../model/EmailVerificationThrottle.js';
import EmailVerificationToken from '../model/EmailVerificationToken.js';

const tokenLifetimeMs = 24 * 60 * 60 * 1000;
const hourMs = 60 * 60 * 1000;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

export async function issueVerificationEmail(user: { _id: Types.ObjectId; email: string }): Promise<boolean> {
  const token = randomBytes(32).toString('base64url');
  const record = await EmailVerificationToken.create({
    userId: user._id,
    tokenHash: hash(token),
    expiresAt: new Date(Date.now() + tokenLifetimeMs)
  });
  const url = new URL('/verify-email', env.appPublicUrl);
  url.hash = new URLSearchParams({ token }).toString();
  try {
    const accepted = await sendVerificationEmail({ to: user.email, verificationUrl: url.toString() });
    if (accepted) return true;
  } catch {
    // The account remains unverified and can request a new email later.
  }
  await EmailVerificationToken.deleteOne({ _id: record._id });
  return false;
}

export async function verifyEmail(token: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new AppError(400, 'VERIFICATION_LINK_INVALID', 'This verification link is invalid or expired.');
  const record = await EmailVerificationToken.findOneAndDelete({
    tokenHash: hash(token),
    expiresAt: { $gt: new Date() }
  });
  if (!record)
    throw new AppError(400, 'VERIFICATION_LINK_INVALID', 'This verification link is invalid or expired.');
  const result = await User.updateOne(
    { _id: record.userId, emailVerificationRequired: true, emailVerifiedAt: null },
    { $set: { emailVerifiedAt: new Date() } }
  );
  if (result.modifiedCount !== 1)
    throw new AppError(400, 'VERIFICATION_LINK_INVALID', 'This verification link is invalid or expired.');
  await EmailVerificationToken.deleteMany({ userId: record.userId });
}

async function acquireLimit(key: string, limit: number, cooldownMs: number) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const now = new Date();
    const previous = await EmailVerificationThrottle.findOne({ key });
    if (!previous) {
      try {
        await EmailVerificationThrottle.create({
          key,
          windowStartedAt: now,
          nextAllowedAt: new Date(now.getTime() + cooldownMs),
          count: 1,
          version: 1,
          expiresAt: new Date(now.getTime() + 2 * hourMs)
        });
        return;
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 11000) continue;
        throw error;
      }
    }
    const reset = now.getTime() - previous.windowStartedAt.getTime() >= hourMs;
    if (!reset && previous.count >= limit)
      throw new AppError(429, 'VERIFICATION_RATE_LIMITED', 'Too many requests. Please try again later.');
    if (previous.nextAllowedAt > now)
      throw new AppError(429, 'VERIFICATION_COOLDOWN', 'Please wait before requesting another email.');
    const updated = await EmailVerificationThrottle.findOneAndUpdate(
      { key, version: previous.version },
      {
        $set: {
          windowStartedAt: reset ? now : previous.windowStartedAt,
          nextAllowedAt: new Date(now.getTime() + cooldownMs),
          count: reset ? 1 : previous.count + 1,
          expiresAt: new Date(now.getTime() + 2 * hourMs)
        },
        $inc: { version: 1 }
      },
      { new: true }
    );
    if (updated) return;
  }
  throw new AppError(429, 'VERIFICATION_RATE_LIMITED', 'Too many requests. Please try again later.');
}

export async function resendVerification(userId: string, ipAddress: string): Promise<boolean> {
  const user = await User.findById(userId);
  if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Not signed in.');
  if (user.emailVerifiedAt) throw new AppError(409, 'EMAIL_ALREADY_VERIFIED', 'Email is already verified.');
  if (!user.emailVerificationRequired)
    throw new AppError(
      403,
      'LEGACY_VERIFICATION_PENDING',
      'Verification for this account is not available yet.'
    );
  await acquireLimit(`user:${userId}`, env.resendHourlyLimit, env.resendCooldownSeconds * 1000);
  await acquireLimit(`ip:${hash(ipAddress)}`, env.resendIpHourlyLimit, 0);
  const accepted = await issueVerificationEmail(user);
  if (!accepted)
    throw new AppError(503, 'EMAIL_DELIVERY_UNAVAILABLE', 'Email could not be sent. Please try again later.');
  return true;
}
