import type { ProfessionalProfile, PublicProfileResponseData } from '@voklance/shared';
import type { Types } from 'mongoose';
import { AppError } from '../../../common/AppError.js';
import Profile, { type ProfileRecord } from '../model/Profile.js';
import { basicProfileSchema, type ProfilePatchInput } from '../validation/profileSchemas.js';
import User from '../../users/model/User.js';
import { getOwnSkills } from '../../skills/service/skillService.js';
import { getOwnExperiences, getOwnEducations } from './historyService.js';

export function toProfileDto(record: ProfileRecord & { _id: Types.ObjectId }): ProfessionalProfile {
  return {
    id: record._id.toString(),
    username: record.username,
    fullName: record.fullName,
    headline: record.headline,
    country: record.country,
    ...(record.city ? { city: record.city } : {}),
    ...(record.bio ? { bio: record.bio } : {}),
    ...(record.avatarUrl ? { avatarUrl: record.avatarUrl } : {}),
    ...(record.professionalStatus ? { professionalStatus: record.professionalStatus } : {}),
    ...(record.githubUrl ? { githubUrl: record.githubUrl } : {}),
    ...(record.portfolioUrl ? { portfolioUrl: record.portfolioUrl } : {}),
    ...(record.websiteUrl ? { websiteUrl: record.websiteUrl } : {}),
    visibility: record.visibility ?? 'PRIVATE'
  };
}

export async function getOwnProfile(userId: string): Promise<ProfessionalProfile | null> {
  const record = await Profile.findOne({ userId }).lean();
  return record ? toProfileDto(record) : null;
}

export async function updateOwnProfile(
  userId: string,
  input: ProfilePatchInput
): Promise<ProfessionalProfile> {
  try {
    const existing = await Profile.findOne({ userId }).select('_id').lean();
    if (!existing) {
      const { professionalStatus, ...basicFields } = input;
      const basic = basicProfileSchema.safeParse(basicFields);
      if (!basic.success)
        throw new AppError(400, 'PROFILE_INCOMPLETE', 'Create a profile with the required fields first.');
      const created = await Profile.create({ userId, ...basic.data, professionalStatus });
      return toProfileDto(created);
    }

    const updated = await Profile.findOneAndUpdate(
      { userId },
      { $set: input },
      { new: true, runValidators: true }
    );
    if (!updated) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found.');
    return toProfileDto(updated);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      const keyPattern = 'keyPattern' in error ? error.keyPattern : undefined;
      if (keyPattern && typeof keyPattern === 'object' && 'username' in keyPattern)
        throw new AppError(409, 'USERNAME_TAKEN', 'Username is already in use.');
      throw new AppError(409, 'PROFILE_CONFLICT', 'Profile already exists. Please retry.');
    }
    throw error;
  }
}

export async function getPublicProfile(username: string): Promise<PublicProfileResponseData> {
  const record = await Profile.findOne({ username, visibility: 'PUBLIC' }).lean();
  if (!record) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found.');
  const owner = await User.findById(record.userId).select('accountStatus onboardingStatus').lean();
  if (
    !owner ||
    (owner.accountStatus && owner.accountStatus !== 'ACTIVE') ||
    owner.onboardingStatus !== 'COMPLETED'
  )
    throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found.');
  const [skills, experiences, education] = await Promise.all([
    getOwnSkills(record.userId.toString()),
    getOwnExperiences(record.userId.toString()),
    getOwnEducations(record.userId.toString())
  ]);
  const { id: _id, visibility: _visibility, avatarUrl: _avatarUrl, ...profile } = toProfileDto(record);
  return { profile, skills, experiences, education };
}

export async function checkUsername(userId: string, username: string) {
  const owner = await Profile.findOne({ username }).select('userId').lean();
  return { username, available: !owner || owner.userId.toString() === userId };
}
