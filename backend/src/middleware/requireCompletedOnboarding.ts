import type { RequestHandler } from 'express';
import { AppError } from '../common/AppError.js';
import { authenticatedUser } from './requireAuth.js';

// Apply after requireAuth only on future application routes that require a completed profile.
// The current onboarding, catalog, profile and history routes must remain available during setup.
export const requireCompletedOnboarding: RequestHandler = (request, _response, next) => {
  if (authenticatedUser(request).onboardingStatus !== 'COMPLETED')
    throw new AppError(403, 'ONBOARDING_REQUIRED', 'Complete onboarding to access this resource.');
  next();
};
