import type { Request, RequestHandler } from 'express';
import type { AuthUser } from '@voklance/shared';
import { AppError } from '../common/AppError.js';
import { getCurrentUser, sessionCookieName } from '../modules/auth/service/authService.js';

export const requireAuth: RequestHandler = async (request, _response, next) => {
  const token = request.cookies?.[sessionCookieName];
  request.authUser = await getCurrentUser(typeof token === 'string' ? token : undefined);
  next();
};

export function authenticatedUser(request: Request): AuthUser {
  if (!request.authUser) throw new AppError(401, 'UNAUTHENTICATED', 'Not signed in.');
  return request.authUser;
}
