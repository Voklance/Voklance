import mongoose from 'mongoose';
import type { ProfileRatingSummary } from '@voklance/shared';
import { AppError } from '../../../common/AppError.js';
import ProfileRating from '../model/ProfileRating.js';
import Profile from '../model/Profile.js';
import ProfileUsernameAlias from '../model/ProfileUsernameAlias.js';
import User from '../../users/model/User.js';

export async function ratingSummary(profileUserId: string): Promise<ProfileRatingSummary> {
  const [result] = await ProfileRating.aggregate<{ count: number; total: number }>([
    { $match: { profileUserId: new mongoose.Types.ObjectId(profileUserId) } },
    { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$stars' } } }
  ]);
  return result
    ? { average: Math.round((result.total / result.count) * 10) / 10, count: result.count }
    : { average: null, count: 0 };
}

async function publicProfileUserId(username: string) {
  const direct = await Profile.findOne({ username, visibility: 'PUBLIC' }).select('userId').lean();
  const alias = direct ? null : await ProfileUsernameAlias.findOne({ username }).select('userId').lean();
  const record =
    direct ??
    (alias
      ? await Profile.findOne({ userId: alias.userId, visibility: 'PUBLIC' }).select('userId').lean()
      : null);
  if (!record) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found.');
  const owner = await User.findById(record.userId).select('accountStatus onboardingStatus').lean();
  if (
    !owner ||
    (owner.accountStatus && owner.accountStatus !== 'ACTIVE') ||
    owner.onboardingStatus !== 'COMPLETED'
  )
    throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found.');
  return record.userId.toString();
}

export async function publicRating(username: string, reviewerUserId: string) {
  const profileUserId = await publicProfileUserId(username);
  const [summary, own] = await Promise.all([
    ratingSummary(profileUserId),
    ProfileRating.findOne({ profileUserId, reviewerUserId }).select('stars').lean()
  ]);
  return { ...summary, myRating: own?.stars ?? null };
}

export async function savePublicRating(username: string, reviewerUserId: string, stars: number) {
  const profileUserId = await publicProfileUserId(username);
  if (profileUserId === reviewerUserId)
    throw new AppError(403, 'SELF_RATING_NOT_ALLOWED', 'You cannot rate your own profile.');
  await ProfileRating.findOneAndUpdate(
    { profileUserId, reviewerUserId },
    { $set: { stars } },
    { upsert: true, new: true, runValidators: true }
  );
  return publicRating(username, reviewerUserId);
}
