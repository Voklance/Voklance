import type { RequestHandler } from 'express';
import { AppError } from '../common/AppError.js';
import { env } from '../config/env.js';

export const requireEmailVerificationEnabled: RequestHandler = (_request, _response, next) => {
  if (!env.emailVerificationEnabled)
    throw new AppError(503, 'EMAIL_VERIFICATION_DISABLED', 'Email verification is currently unavailable.');
  next();
};
