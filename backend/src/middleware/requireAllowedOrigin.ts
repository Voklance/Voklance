import type { RequestHandler } from 'express';
import { AppError } from '../common/AppError.js';
import { isAllowedOrigin } from '../config/env.js';

export const requireAllowedOrigin: RequestHandler = (request, _response, next) => {
  const origin = request.get('origin');
  if (origin && !isAllowedOrigin(origin)) {
    next(new AppError(403, 'ORIGIN_NOT_ALLOWED', 'Request origin is not allowed.'));
    return;
  }
  next();
};
