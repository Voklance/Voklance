import { NOTIFICATION_CATEGORIES } from '@voklance/shared';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { sendFailure, sendSuccess } from '../../../common/apiResponse.js';
import { requireAllowedOrigin } from '../../../middleware/requireAllowedOrigin.js';
import { authenticatedUser, requireAuth } from '../../../middleware/requireAuth.js';
import { requireCompletedOnboarding } from '../../../middleware/requireCompletedOnboarding.js';
import { requireDatabase } from '../../../middleware/requireDatabase.js';
import { requireVerifiedEmail } from '../../../middleware/requireVerifiedEmail.js';
import { validateBody } from '../../../middleware/validateBody.js';
import { validateParams } from '../../../middleware/validateParams.js';
import { validateQuery } from '../../../middleware/validateQuery.js';
import {
  getPreferences,
  listNotifications,
  markAllRead,
  markRead,
  savePreferences,
  unreadCount
} from '../service/notificationService.js';
const category = z.enum(NOTIFICATION_CATEGORIES);
const query = z
  .object({
    category: category.optional(),
    unreadOnly: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z
      .string()
      .regex(/^[0-9a-f]{24}$/i)
      .optional()
  })
  .strict();
const readAllBody = z.object({ category: category.optional() }).strict();
const preferencesBody = z
  .object({
    preferences: z
      .object(
        Object.fromEntries(NOTIFICATION_CATEGORIES.map((item) => [item, z.boolean().optional()])) as Record<
          (typeof NOTIFICATION_CATEGORIES)[number],
          z.ZodOptional<z.ZodBoolean>
        >
      )
      .strict()
      .refine((value) => Object.keys(value).length > 0)
  })
  .strict();
const idParams = z.object({ notificationId: z.string().regex(/^[0-9a-f]{24}$/i) }).strict();
const writeLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 60,
  keyGenerator: (request) => authenticatedUser(request).id,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response) =>
    sendFailure(response, 429, 'RATE_LIMITED', 'Too many notification actions.')
});
const routes = Router();
routes.use(
  requireDatabase,
  requireAllowedOrigin,
  requireAuth,
  requireVerifiedEmail,
  requireCompletedOnboarding
);
routes.get('/', validateQuery(query), async (request, response) =>
  sendSuccess(
    response,
    await listNotifications(authenticatedUser(request).id, request.validatedQuery as z.infer<typeof query>),
    'Notifications loaded'
  )
);
routes.get('/unread-count', async (request, response) =>
  sendSuccess(
    response,
    { unreadCount: await unreadCount(authenticatedUser(request).id) },
    'Unread count loaded'
  )
);
routes.get('/preferences', async (request, response) =>
  sendSuccess(
    response,
    { preferences: await getPreferences(authenticatedUser(request).id) },
    'Notification preferences loaded'
  )
);
routes.patch('/preferences', writeLimit, validateBody(preferencesBody), async (request, response) =>
  sendSuccess(
    response,
    {
      preferences: await savePreferences(
        authenticatedUser(request).id,
        (request.body as z.infer<typeof preferencesBody>).preferences
      )
    },
    'Notification preferences saved'
  )
);
routes.patch('/read-all', writeLimit, validateBody(readAllBody), async (request, response) =>
  sendSuccess(
    response,
    await markAllRead(authenticatedUser(request).id, (request.body as z.infer<typeof readAllBody>).category),
    'Notifications marked read'
  )
);
routes.patch('/:notificationId/read', writeLimit, validateParams(idParams), async (request, response) =>
  sendSuccess(
    response,
    {
      notification: await markRead(
        authenticatedUser(request).id,
        (request.validatedParams as z.infer<typeof idParams>).notificationId
      )
    },
    'Notification marked read'
  )
);
export default routes;
