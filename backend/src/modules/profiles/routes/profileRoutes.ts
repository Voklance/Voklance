import { Router } from 'express';
import { requireAllowedOrigin } from '../../../middleware/requireAllowedOrigin.js';
import { requireAuth } from '../../../middleware/requireAuth.js';
import { requireVerifiedEmail } from '../../../middleware/requireVerifiedEmail.js';
import { requireDatabase } from '../../../middleware/requireDatabase.js';
import { validateBody } from '../../../middleware/validateBody.js';
import { validateQuery } from '../../../middleware/validateQuery.js';
import { validateParams } from '../../../middleware/validateParams.js';
import { getMe, getPublic, getUsernameAvailability, patchMe } from '../controller/profileController.js';
import {
  profilePatchSchema,
  publicUsernameParamsSchema,
  usernameQuerySchema
} from '../validation/profileSchemas.js';

const router = Router();
router.use(requireDatabase, requireAllowedOrigin);
router.get('/public/:username', validateParams(publicUsernameParamsSchema), getPublic);
router.get(
  '/check-username',
  requireAuth,
  requireVerifiedEmail,
  validateQuery(usernameQuerySchema),
  getUsernameAvailability
);
router.get('/me', requireAuth, requireVerifiedEmail, getMe);
router.patch('/me', requireAuth, requireVerifiedEmail, validateBody(profilePatchSchema), patchMe);
router.get('/:username', validateParams(publicUsernameParamsSchema), getPublic);

export default router;
