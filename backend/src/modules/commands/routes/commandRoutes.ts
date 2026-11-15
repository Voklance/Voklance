import { Router, type Request, type Response, type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
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
  availableCommands,
  deleteActivity,
  listActivities,
  submitCommand
} from '../service/commandService.js';
import {
  activityParams,
  activityQuery,
  communityParams,
  submissionBody,
  type ActivityQuery
} from '../validation/commandSchemas.js';

const router = Router();
const commandAccess: RequestHandler[] = [
  requireDatabase,
  requireAllowedOrigin,
  requireAuth,
  requireVerifiedEmail,
  requireCompletedOnboarding
];
const writeLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: (request) => authenticatedUser(request).id,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response) =>
    sendFailure(response, 429, 'RATE_LIMITED', 'Too many community actions. Please try again later.')
});
const userId = (request: Parameters<typeof authenticatedUser>[0]) => authenticatedUser(request).id;
const param = (request: { validatedParams?: unknown }, key: string) =>
  (request.validatedParams as Record<string, string>)[key];

router.get(
  '/:communityId/commands',
  commandAccess,
  validateParams(communityParams),
  async (request: Request, response: Response) => {
    sendSuccess(
      response,
      { commands: await availableCommands(param(request, 'communityId'), userId(request)) },
      'Commands loaded'
    );
  }
);
router.post(
  '/:communityId/commands',
  commandAccess,
  writeLimit,
  validateParams(communityParams),
  validateBody(submissionBody),
  async (request: Request, response: Response) => {
    sendSuccess(
      response,
      { activity: await submitCommand(param(request, 'communityId'), userId(request), request.body) },
      'Activity published',
      201
    );
  }
);
router.get(
  '/:communityId/activities',
  commandAccess,
  validateParams(communityParams),
  validateQuery(activityQuery),
  async (request: Request, response: Response) => {
    sendSuccess(
      response,
      await listActivities(
        param(request, 'communityId'),
        userId(request),
        request.validatedQuery as ActivityQuery
      ),
      'Activities loaded'
    );
  }
);
router.delete(
  '/:communityId/activities/:activityId',
  commandAccess,
  writeLimit,
  validateParams(activityParams),
  async (request: Request, response: Response) => {
    await deleteActivity(param(request, 'communityId'), param(request, 'activityId'), userId(request));
    sendSuccess(response, {}, 'Activity deleted');
  }
);
export default router;
