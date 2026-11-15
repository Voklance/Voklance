import { Router } from 'express';
import { idParamSchema } from '../../../common/validationSchemas.js';
import { requireAllowedOrigin } from '../../../middleware/requireAllowedOrigin.js';
import { requireAuth } from '../../../middleware/requireAuth.js';
import { requireVerifiedEmail } from '../../../middleware/requireVerifiedEmail.js';
import { requireDatabase } from '../../../middleware/requireDatabase.js';
import { validateBody } from '../../../middleware/validateBody.js';
import { validateParams } from '../../../middleware/validateParams.js';
import {
  listEducations,
  listExperiences,
  patchEducation,
  patchExperience,
  postEducation,
  postExperience,
  removeEducation,
  removeExperience
} from '../controller/historyController.js';
import {
  educationPatchSchema,
  educationSchema,
  experiencePatchSchema,
  experienceSchema
} from '../validation/historySchemas.js';

const experienceRouter = Router();
experienceRouter.use(requireDatabase, requireAllowedOrigin, requireAuth, requireVerifiedEmail);
experienceRouter.get('/', listExperiences);
experienceRouter.post('/', validateBody(experienceSchema), postExperience);
experienceRouter.patch(
  '/:id',
  validateParams(idParamSchema),
  validateBody(experiencePatchSchema),
  patchExperience
);
experienceRouter.delete('/:id', validateParams(idParamSchema), removeExperience);

const educationRouter = Router();
educationRouter.use(requireDatabase, requireAllowedOrigin, requireAuth, requireVerifiedEmail);
educationRouter.get('/', listEducations);
educationRouter.post('/', validateBody(educationSchema), postEducation);
educationRouter.patch(
  '/:id',
  validateParams(idParamSchema),
  validateBody(educationPatchSchema),
  patchEducation
);
educationRouter.delete('/:id', validateParams(idParamSchema), removeEducation);

export { experienceRouter as experienceRoutes, educationRouter as educationRoutes };
