import { Router } from 'express';
import { requireAllowedOrigin } from '../../../middleware/requireAllowedOrigin.js';
import { requireAuth } from '../../../middleware/requireAuth.js';
import { requireVerifiedEmail } from '../../../middleware/requireVerifiedEmail.js';
import { requireDatabase } from '../../../middleware/requireDatabase.js';
import { validateBody } from '../../../middleware/validateBody.js';
import {
  getProgress,
  patchIdentity,
  patchProgress,
  postComplete
} from '../controller/onboardingController.js';
import {
  onboardingCompleteSchema,
  onboardingIdentitySchema,
  onboardingProgressSchema
} from '../validation/onboardingSchemas.js';

const router = Router();
router.use(requireDatabase, requireAllowedOrigin, requireAuth, requireVerifiedEmail);
router.get('/', getProgress);
router.patch('/profile', validateBody(onboardingIdentitySchema), patchIdentity);
router.patch('/', validateBody(onboardingProgressSchema), patchProgress);
router.post('/complete', validateBody(onboardingCompleteSchema), postComplete);

export default router;
