import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { sendFailure, sendSuccess } from '../../../common/apiResponse.js';
import { authenticatedUser, requireAuth } from '../../../middleware/requireAuth.js';
import { requireAllowedOrigin } from '../../../middleware/requireAllowedOrigin.js';
import { requireCompletedOnboarding } from '../../../middleware/requireCompletedOnboarding.js';
import { requireDatabase } from '../../../middleware/requireDatabase.js';
import { requireVerifiedEmail } from '../../../middleware/requireVerifiedEmail.js';
import { validateBody } from '../../../middleware/validateBody.js';
import { validateParams } from '../../../middleware/validateParams.js';
import {
  certificationBody,
  certificationPatch,
  idParams,
  projectBody,
  projectPatch
} from '../validation/portfolioSchemas.js';
import {
  createCertification,
  createProject,
  deleteCertification,
  deleteProject,
  listCertifications,
  listProjects,
  updateCertification,
  updateProject
} from '../service/portfolioService.js';
import { profileCompleteness } from '../service/profileCompletenessService.js';
import type { z } from 'zod';

const router = Router();
const user = (request: Parameters<typeof authenticatedUser>[0]) => authenticatedUser(request).id;
const id = (request: { validatedParams?: unknown }) => (request.validatedParams as { id: string }).id;
const writeLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 40,
  keyGenerator: (request) => user(request),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response) =>
    sendFailure(response, 429, 'RATE_LIMITED', 'Too many portfolio changes. Try again later.')
});
router.use(
  requireDatabase,
  requireAllowedOrigin,
  requireAuth,
  requireVerifiedEmail,
  requireCompletedOnboarding
);
router.get('/certifications', async (request, response) =>
  sendSuccess(response, { items: await listCertifications(user(request)) }, 'Certifications loaded')
);
router.post('/certifications', writeLimit, validateBody(certificationBody), async (request, response) =>
  sendSuccess(
    response,
    { item: await createCertification(user(request), request.body as z.infer<typeof certificationBody>) },
    'Certification added',
    201
  )
);
router.patch(
  '/certifications/:id',
  writeLimit,
  validateParams(idParams),
  validateBody(certificationPatch),
  async (request, response) =>
    sendSuccess(
      response,
      { item: await updateCertification(user(request), id(request), request.body) },
      'Certification updated'
    )
);
router.delete('/certifications/:id', writeLimit, validateParams(idParams), async (request, response) =>
  sendSuccess(response, await deleteCertification(user(request), id(request)), 'Certification removed')
);
router.get('/projects', async (request, response) =>
  sendSuccess(response, { items: await listProjects(user(request)) }, 'Projects loaded')
);
router.post('/projects', writeLimit, validateBody(projectBody), async (request, response) =>
  sendSuccess(
    response,
    { item: await createProject(user(request), request.body as z.infer<typeof projectBody>) },
    'Project added',
    201
  )
);
router.patch(
  '/projects/:id',
  writeLimit,
  validateParams(idParams),
  validateBody(projectPatch),
  async (request, response) =>
    sendSuccess(
      response,
      { item: await updateProject(user(request), id(request), request.body) },
      'Project updated'
    )
);
router.delete('/projects/:id', writeLimit, validateParams(idParams), async (request, response) =>
  sendSuccess(response, await deleteProject(user(request), id(request)), 'Project removed')
);
router.get('/completeness', async (request, response) =>
  sendSuccess(response, await profileCompleteness(user(request)), 'Profile completeness loaded')
);
export default router;
