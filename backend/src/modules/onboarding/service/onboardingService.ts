import type { OnboardingSnapshot, OnboardingStep } from '@voklance/shared';
import { AppError } from '../../../common/AppError.js';
import { getOwnInterests } from '../../interests/service/interestService.js';
import { getOwnEducations, getOwnExperiences } from '../../profiles/service/historyService.js';
import { getOwnProfile } from '../../profiles/service/profileService.js';
import { basicProfileSchema } from '../../profiles/validation/profileSchemas.js';
import { getOwnSkills } from '../../skills/service/skillService.js';
import User from '../../users/model/User.js';
import UserInterest from '../../interests/model/UserInterest.js';
import UserSkill from '../../skills/model/UserSkill.js';

function profileReady(profile: OnboardingSnapshot['profile']) {
  return (
    !!profile &&
    basicProfileSchema.safeParse({
      username: profile.username,
      fullName: profile.fullName,
      headline: profile.headline,
      country: profile.country,
      city: profile.city,
      bio: profile.bio
    }).success
  );
}

function completedSteps(snapshot: Omit<OnboardingSnapshot, 'completedSteps'>): OnboardingStep[] {
  const result: OnboardingStep[] = [];
  if (profileReady(snapshot.profile)) result.push(1);
  if (snapshot.profile?.professionalStatus) result.push(2);
  if (snapshot.skills.length) result.push(3);
  if (snapshot.currentStep >= 5 || snapshot.status === 'COMPLETED') result.push(4);
  if (snapshot.interests.length) result.push(5);
  if (snapshot.status === 'COMPLETED') result.push(6);
  return result;
}

export async function getOnboardingSnapshot(userId: string): Promise<OnboardingSnapshot> {
  const [user, profile, skills, interests, experiences, education] = await Promise.all([
    User.findById(userId).select('onboardingStatus onboardingStep onboardingCompletedAt').lean(),
    getOwnProfile(userId),
    getOwnSkills(userId),
    getOwnInterests(userId),
    getOwnExperiences(userId),
    getOwnEducations(userId)
  ]);
  if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Not signed in.');
  const snapshot: Omit<OnboardingSnapshot, 'completedSteps'> = {
    status: user.onboardingStatus ?? 'NOT_STARTED',
    currentStep: user.onboardingStep ?? 1,
    ...(user.onboardingCompletedAt ? { completedAt: user.onboardingCompletedAt.toISOString() } : {}),
    profile,
    skills,
    interests,
    experiences,
    education
  };
  return { ...snapshot, completedSteps: completedSteps(snapshot) };
}

function maxAllowedStep(snapshot: OnboardingSnapshot): OnboardingStep {
  if (!snapshot.completedSteps.includes(1)) return 1;
  if (!snapshot.completedSteps.includes(2)) return 2;
  if (!snapshot.completedSteps.includes(3)) return 3;
  if (!snapshot.completedSteps.includes(5)) return 5;
  return 6;
}

export async function saveOnboardingProgress(userId: string, currentStep: OnboardingStep) {
  const snapshot = await getOnboardingSnapshot(userId);
  if (snapshot.status === 'COMPLETED') return snapshot;
  if (currentStep > maxAllowedStep(snapshot))
    throw new AppError(409, 'INVALID_ONBOARDING_STEP', 'Complete earlier onboarding steps first.');

  await User.updateOne(
    { _id: userId, onboardingStatus: { $ne: 'COMPLETED' } },
    { $set: { onboardingStatus: 'IN_PROGRESS', onboardingStep: currentStep } }
  );
  return getOnboardingSnapshot(userId);
}

export async function completeOnboarding(userId: string) {
  const snapshot = await getOnboardingSnapshot(userId);
  if (snapshot.status === 'COMPLETED') return snapshot;
  if (
    !profileReady(snapshot.profile) ||
    !snapshot.profile?.professionalStatus ||
    !snapshot.skills.length ||
    !snapshot.interests.length
  )
    throw new AppError(
      409,
      'ONBOARDING_INCOMPLETE',
      'Complete your profile, professional status, skills, and interests first.'
    );

  const [skillLinks, interestLinks] = await Promise.all([
    UserSkill.countDocuments({ userId }),
    UserInterest.countDocuments({ userId })
  ]);
  if (skillLinks !== snapshot.skills.length || interestLinks !== snapshot.interests.length)
    throw new AppError(409, 'ONBOARDING_INVALID_REFERENCES', 'Some selected items are no longer available.');

  await User.updateOne(
    { _id: userId, onboardingStatus: { $ne: 'COMPLETED' } },
    {
      $set: {
        onboardingStatus: 'COMPLETED',
        onboardingStep: 6,
        onboardingCompletedAt: new Date()
      }
    }
  );
  return getOnboardingSnapshot(userId);
}
