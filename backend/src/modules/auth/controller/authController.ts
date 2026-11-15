import type { RequestHandler, Response } from 'express';
import { sendSuccess } from '../../../common/apiResponse.js';
import { env } from '../../../config/env.js';
import {
  authenticate,
  getCurrentUser,
  register,
  revokeSession,
  sessionAgeMs,
  sessionCookieName
} from '../service/authService.js';
import type { LoginInput, SignupInput } from '../validation/authSchemas.js';
import { resendVerification, verifyEmail } from '../service/emailVerificationService.js';
import { authenticatedUser } from '../../../middleware/requireAuth.js';

function setSessionCookie(response: Response, token: string) {
  response.cookie(sessionCookieName, token, {
    httpOnly: true,
    secure: env.secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: sessionAgeMs
  });
}

function readSessionCookie(request: Parameters<RequestHandler>[0]) {
  const token = request.cookies?.[sessionCookieName];
  return typeof token === 'string' ? token : undefined;
}

export const signup: RequestHandler = async (request, response) => {
  const result = await register(request.body as SignupInput);
  setSessionCookie(response, result.token);
  sendSuccess(
    response,
    { user: result.user, verificationEmailSent: result.verificationEmailSent },
    'Account created',
    201
  );
};

export const login: RequestHandler = async (request, response) => {
  const result = await authenticate(request.body as LoginInput);
  setSessionCookie(response, result.token);
  sendSuccess(response, { user: result.user }, 'Signed in');
};

export const me: RequestHandler = async (request, response) => {
  const user = await getCurrentUser(readSessionCookie(request));
  sendSuccess(response, { user }, 'Current account');
};

export const logout: RequestHandler = async (request, response) => {
  await revokeSession(readSessionCookie(request));
  response.clearCookie(sessionCookieName, {
    httpOnly: true,
    secure: env.secureCookies,
    sameSite: 'lax',
    path: '/'
  });
  sendSuccess(response, {}, 'Signed out');
};

export const verifyEmailAddress: RequestHandler = async (request, response) => {
  await verifyEmail((request.body as { token: string }).token);
  sendSuccess(response, { verified: true }, 'Email verified successfully');
};

export const resendVerificationEmail: RequestHandler = async (request, response) => {
  const user = authenticatedUser(request);
  await resendVerification(user.id, request.ip ?? 'unknown');
  sendSuccess(response, { sent: true }, 'Verification email sent');
};
