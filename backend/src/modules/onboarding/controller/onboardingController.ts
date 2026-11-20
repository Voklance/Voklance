import type { RequestHandler } from 'express';
import { sendSuccess } from '../../../common/apiResponse.js';
import { authenticatedUser } from '../../../middleware/requireAuth.js';
import {
  completeOnboarding,
  getOnboardingSnapshot,
  saveOnboardingProgress
} from '../service/onboardingService.js';
import type { OnboardingProgressInput } from '../validation/onboardingSchemas.js';
import type { OnboardingIdentityInput } from '../validation/onboardingSchemas.js';
import { saveOnboardingIdentity } from '../../profiles/service/profileService.js';

export const getProgress: RequestHandler = async (request, response) => {
  const onboarding = await getOnboardingSnapshot(authenticatedUser(request).id);
  sendSuccess(response, { onboarding }, 'Onboarding loaded');
};

export const patchProgress: RequestHandler = async (request, response) => {
  const { currentStep } = request.body as OnboardingProgressInput;
  const onboarding = await saveOnboardingProgress(authenticatedUser(request).id, currentStep);
  sendSuccess(response, { onboarding }, 'Onboarding progress saved');
};

export const patchIdentity: RequestHandler = async (request, response) => {
  const profile = await saveOnboardingIdentity(
    authenticatedUser(request).id,
    request.body as OnboardingIdentityInput
  );
  sendSuccess(response, { profile }, 'Profile basics saved');
};

export const postComplete: RequestHandler = async (request, response) => {
  const onboarding = await completeOnboarding(authenticatedUser(request).id);
  sendSuccess(response, { onboarding }, 'Onboarding completed');
};
