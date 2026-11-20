import type { ProfessionalProfile, PublicProfileResponseData } from '@voklance/shared';
import type { Types } from 'mongoose';
import { AppError } from '../../../common/AppError.js';
import Profile, { type ProfileRecord } from '../model/Profile.js';
import { basicProfileSchema, type ProfilePatchInput } from '../validation/profileSchemas.js';
import User from '../../users/model/User.js';
import { getOwnSkills } from '../../skills/service/skillService.js';
import { getOwnExperiences, getOwnEducations } from './historyService.js';
import { listCertifications, listProjects } from './portfolioService.js';
import ProfileUsernameAlias from '../model/ProfileUsernameAlias.js';
import type { OnboardingIdentityInput } from '../../onboarding/validation/onboardingSchemas.js';

export function splitFullName(fullName: string) {
  const [firstName = '', ...rest] = fullName.trim().split(/\s+/);
  return { firstName, lastName: rest.join(' ') };
}

export function toProfileDto(record: ProfileRecord & { _id: Types.ObjectId }): ProfessionalProfile {
  const fallback = splitFullName(record.fullName);
  return {
    id: record._id.toString(),
    username: record.username,
    fullName: record.fullName,
    firstName: record.firstName ?? fallback.firstName,
    lastName: record.lastName ?? fallback.lastName,
    headline: record.headline,
    country: record.country ?? '',
    ...(record.city ? { city: record.city } : {}),
    ...(record.bio ? { bio: record.bio } : {}),
    ...(record.avatarUrl ? { avatarUrl: record.avatarUrl } : {}),
    ...(record.professionalStatus ? { professionalStatus: record.professionalStatus } : {}),
    ...(record.githubUrl ? { githubUrl: record.githubUrl } : {}),
    ...(record.portfolioUrl ? { portfolioUrl: record.portfolioUrl } : {}),
    ...(record.websiteUrl ? { websiteUrl: record.websiteUrl } : {}),
    visibility: record.visibility ?? 'PRIVATE',
    sectionOrder: record.sectionOrder
  };
}

async function generatedUsername(userId: string) {
  for (const prefix of ['u', 'v', 'w']) {
    const username = `${prefix}-${userId}`;
    const [profile, alias] = await Promise.all([
      Profile.exists({ username }),
      ProfileUsernameAlias.exists({ username })
    ]);
    if (!profile && !alias) return username;
  }
  throw new AppError(409, 'PROFILE_IDENTIFIER_UNAVAILABLE', 'Could not create a profile. Please retry.');
}

export async function saveOnboardingIdentity(userId: string, input: OnboardingIdentityInput) {
  const fullName = `${input.firstName} ${input.lastName}`;
  const changes = {
    firstName: input.firstName,
    lastName: input.lastName,
    headline: input.headline ?? '',
    fullName
  };
  const existing = await Profile.findOne({ userId }).select('_id').lean();
  const profile = existing
    ? await Profile.findOneAndUpdate({ userId }, { $set: changes }, { new: true, runValidators: true })
    : await Profile.create({
        userId,
        username: await generatedUsername(userId),
        country: '',
        ...changes
      });
  if (!profile) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found.');
  await User.updateOne({ _id: userId }, { $set: { name: fullName } });
  return toProfileDto(profile);
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
    const existing = await Profile.findOne({ userId }).select('_id username').lean();
    if (input.username) {
      const reserved = await ProfileUsernameAlias.findOne({ username: input.username })
        .select('userId')
        .lean();
      if (reserved && reserved.userId.toString() !== userId)
        throw new AppError(409, 'USERNAME_TAKEN', 'Username is already in use.');
    }
    if (!existing) {
      const { professionalStatus, ...basicFields } = input;
      const basic = basicProfileSchema.safeParse(basicFields);
      if (!basic.success)
        throw new AppError(400, 'PROFILE_INCOMPLETE', 'Create a profile with the required fields first.');
      const created = await Profile.create({
        userId,
        ...basic.data,
        ...splitFullName(basic.data.fullName),
        professionalStatus
      });
      return toProfileDto(created);
    }

    if (input.username && input.username !== existing.username) {
      await ProfileUsernameAlias.updateOne(
        { username: existing.username },
        { $setOnInsert: { username: existing.username, userId } },
        { upsert: true }
      );
    }

    const updated = await Profile.findOneAndUpdate(
      { userId },
      { $set: input.fullName ? { ...input, ...splitFullName(input.fullName) } : input },
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
  const direct = await Profile.findOne({ username, visibility: 'PUBLIC' }).lean();
  const alias = direct ? null : await ProfileUsernameAlias.findOne({ username }).select('userId').lean();
  const record =
    direct ?? (alias ? await Profile.findOne({ userId: alias.userId, visibility: 'PUBLIC' }).lean() : null);
  if (!record) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found.');
  const owner = await User.findById(record.userId).select('accountStatus onboardingStatus').lean();
  if (
    !owner ||
    (owner.accountStatus && owner.accountStatus !== 'ACTIVE') ||
    owner.onboardingStatus !== 'COMPLETED'
  )
    throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found.');
  const [skills, experiences, education, certifications, projects] = await Promise.all([
    getOwnSkills(record.userId.toString()),
    getOwnExperiences(record.userId.toString()),
    getOwnEducations(record.userId.toString()),
    listCertifications(record.userId.toString()),
    listProjects(record.userId.toString())
  ]);
  const { id: _id, visibility: _visibility, avatarUrl: _avatarUrl, ...profile } = toProfileDto(record);
  return { profile, skills, experiences, education, certifications, projects };
}

export async function checkUsername(userId: string, username: string) {
  const [owner, alias] = await Promise.all([
    Profile.findOne({ username }).select('userId').lean(),
    ProfileUsernameAlias.findOne({ username }).select('userId').lean()
  ]);
  return {
    username,
    available:
      (!owner || owner.userId.toString() === userId) && (!alias || alias.userId.toString() === userId)
  };
}
