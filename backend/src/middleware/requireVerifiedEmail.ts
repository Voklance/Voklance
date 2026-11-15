import type { RequestHandler } from 'express';
import { AppError } from '../common/AppError.js';
import { authenticatedUser } from './requireAuth.js';
import { env } from '../config/env.js';

// Attach after requireAuth on future protected business routes. Legacy access stays unchanged.
export const requireVerifiedEmail: RequestHandler = (request, _response, next) => {
  const user = authenticatedUser(request);
  if (env.emailVerificationEnabled && user.emailVerificationRequired && !user.emailVerifiedAt)
    throw new AppError(403, 'EMAIL_VERIFICATION_REQUIRED', 'Verify your email to access this resource.');
  next();
};
