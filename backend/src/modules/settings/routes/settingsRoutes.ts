import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { AppError } from '../../../common/AppError.js';
import { sendFailure, sendSuccess } from '../../../common/apiResponse.js';
import { env } from '../../../config/env.js';
import { requireAllowedOrigin } from '../../../middleware/requireAllowedOrigin.js';
import { authenticatedUser, requireAuth } from '../../../middleware/requireAuth.js';
import { requireDatabase } from '../../../middleware/requireDatabase.js';
import { validateBody } from '../../../middleware/validateBody.js';
import { validateParams } from '../../../middleware/validateParams.js';
import { sessionCookieName } from '../../auth/service/authService.js';
import { disconnectSessionSockets } from '../../../realtime/socketServer.js';
import {
  accountInfo,
  activeSessions,
  blockedUsers,
  changePassword,
  deactivateAccount,
  exportPersonalData,
  privacySettings,
  revokeAllSessions,
  revokeOneSession,
  revokeOtherSessions,
  updateAccountInfo,
  updatePrivacySettings,
  requestEmailChange,
  confirmEmailChange
} from '../service/settingsService.js';

const router = Router();
router.use(requireDatabase, requireAllowedOrigin, requireAuth);
router.use((_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store');
  next();
});
const writeLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  keyGenerator: (request) => authenticatedUser(request).id,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response) => sendFailure(response, 429, 'RATE_LIMITED', 'Too many settings actions.')
});
const password = z.string().min(1).max(128);
const newPassword = z.string().min(12).max(128);
const confirm = z.object({ currentPassword: password }).strict();
const change = z
  .object({ currentPassword: password, newPassword, confirmPassword: z.string() })
  .strict()
  .refine((input) => input.newPassword === input.confirmPassword, { path: ['confirmPassword'] });
const privacy = z
  .object({
    visibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
    profileDiscoverable: z.boolean().optional(),
    allowConnectionRequests: z.boolean().optional(),
    connectionListVisibility: z.enum(['private', 'connections']).optional(),
    allowDirectMessages: z.boolean().optional(),
    showReadReceipts: z.boolean().optional(),
    showOnlineStatus: z.boolean().optional()
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0);
const sessionParams = z.object({ sessionId: z.string().regex(/^[0-9a-f]{24}$/i) }).strict();
const currentToken = (request: { cookies?: Record<string, unknown> }) =>
  typeof request.cookies?.[sessionCookieName] === 'string'
    ? (request.cookies[sessionCookieName] as string)
    : undefined;
function clearCookie(response: Parameters<typeof sendSuccess>[0]) {
  response.clearCookie(sessionCookieName, {
    httpOnly: true,
    secure: env.secureCookies,
    sameSite: 'lax',
    path: '/'
  });
}
router.get('/account', async (request, response) =>
  sendSuccess(response, await accountInfo(authenticatedUser(request).id), 'Account loaded')
);
router.patch(
  '/account',
  writeLimit,
  validateBody(z.object({ name: z.string().trim().min(2).max(80) }).strict()),
  async (request, response) =>
    sendSuccess(
      response,
      await updateAccountInfo(authenticatedUser(request).id, (request.body as { name: string }).name),
      'Account updated'
    )
);
router.post(
  '/account/email-change',
  writeLimit,
  validateBody(z.object({ currentPassword: password, newEmail: z.email().max(254) }).strict()),
  async (request, response) => {
    const input = request.body as { currentPassword: string; newEmail: string };
    sendSuccess(
      response,
      await requestEmailChange(
        authenticatedUser(request).id,
        input.currentPassword,
        input.newEmail.toLowerCase()
      ),
      'Check your new email to confirm the change.'
    );
  }
);
router.post(
  '/account/email-change/confirm',
  writeLimit,
  validateBody(z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict()),
  async (request, response) => {
    const result = await confirmEmailChange(
      authenticatedUser(request).id,
      (request.body as { token: string }).token
    );
    clearCookie(response);
    sendSuccess(response, result, 'Email changed. Sign in again.');
  }
);
router.post(
  '/account/deactivate',
  writeLimit,
  validateBody(z.object({ currentPassword: password, confirmation: z.literal('DEACTIVATE') }).strict()),
  async (request, response) => {
    const token = currentToken(request);
    const result = await deactivateAccount(
      authenticatedUser(request).id,
      (request.body as { currentPassword: string }).currentPassword
    );
    disconnectSessionSockets(token);
    clearCookie(response);
    sendSuccess(response, result, 'Account deactivated');
  }
);
router.post('/account/delete', writeLimit, async () => {
  throw new AppError(
    503,
    'ACCOUNT_DELETION_UNAVAILABLE',
    'Permanent deletion requires an approved cross-module cleanup workflow. Contact support.'
  );
});
router.get('/security/sessions', async (request, response) =>
  sendSuccess(
    response,
    await activeSessions(authenticatedUser(request).id, currentToken(request)),
    'Sessions loaded'
  )
);
router.delete(
  '/security/sessions/:sessionId',
  writeLimit,
  validateParams(sessionParams),
  async (request, response) => {
    const result = await revokeOneSession(
      authenticatedUser(request).id,
      currentToken(request),
      (request.validatedParams as { sessionId: string }).sessionId
    );
    if (result.signedOut) clearCookie(response);
    sendSuccess(response, result, 'Session revoked');
  }
);
router.post('/security/logout-others', writeLimit, validateBody(confirm), async (request, response) =>
  sendSuccess(
    response,
    await revokeOtherSessions(
      authenticatedUser(request).id,
      currentToken(request),
      (request.body as { currentPassword: string }).currentPassword
    ),
    'Other sessions revoked'
  )
);
router.post('/security/logout-all', writeLimit, validateBody(confirm), async (request, response) => {
  const result = await revokeAllSessions(
    authenticatedUser(request).id,
    (request.body as { currentPassword: string }).currentPassword
  );
  clearCookie(response);
  sendSuccess(response, result, 'All sessions revoked');
});
router.post('/security/change-password', writeLimit, validateBody(change), async (request, response) => {
  const { currentPassword, newPassword } = request.body as { currentPassword: string; newPassword: string };
  const result = await changePassword(authenticatedUser(request).id, currentPassword, newPassword);
  clearCookie(response);
  sendSuccess(response, result, 'Password changed. Sign in again.');
});
router.get('/privacy', async (request, response) =>
  sendSuccess(
    response,
    { settings: await privacySettings(authenticatedUser(request).id) },
    'Privacy settings loaded'
  )
);
router.patch('/privacy', writeLimit, validateBody(privacy), async (request, response) =>
  sendSuccess(
    response,
    {
      settings: await updatePrivacySettings(
        authenticatedUser(request).id,
        request.body as Record<string, boolean | string>
      )
    },
    'Privacy settings saved'
  )
);
router.get('/blocked-users', async (request, response) =>
  sendSuccess(response, await blockedUsers(authenticatedUser(request).id), 'Blocked users loaded')
);
router.post('/data/export', writeLimit, validateBody(confirm), async (request, response) => {
  const result = await exportPersonalData(
    authenticatedUser(request).id,
    (request.body as { currentPassword: string }).currentPassword
  );
  response.setHeader('Content-Disposition', 'attachment; filename="voklance-data.json"');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.send(JSON.stringify(result));
});
export default router;
