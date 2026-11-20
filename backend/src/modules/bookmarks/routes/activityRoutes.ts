import { ACTIVITY_TYPES } from '@voklance/shared';
import { Router } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../../../common/apiResponse.js';
import { authenticatedUser, requireAuth } from '../../../middleware/requireAuth.js';
import { requireAllowedOrigin } from '../../../middleware/requireAllowedOrigin.js';
import { requireCompletedOnboarding } from '../../../middleware/requireCompletedOnboarding.js';
import { requireDatabase } from '../../../middleware/requireDatabase.js';
import { requireVerifiedEmail } from '../../../middleware/requireVerifiedEmail.js';
import { validateQuery } from '../../../middleware/validateQuery.js';
import { personalActivity } from '../service/personalActivityService.js';

const query = z.object({
  type: z.enum(ACTIVITY_TYPES).optional(),
  cursor: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(40).default(20)
});
const router = Router();
router.use(
  requireDatabase,
  requireAllowedOrigin,
  requireAuth,
  requireVerifiedEmail,
  requireCompletedOnboarding
);
router.get('/', validateQuery(query), async (request, response) =>
  sendSuccess(
    response,
    await personalActivity(authenticatedUser(request).id, request.validatedQuery as z.infer<typeof query>),
    'Activity loaded'
  )
);
export default router;
