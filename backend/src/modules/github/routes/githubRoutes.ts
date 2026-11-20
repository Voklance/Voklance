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
import { env } from '../../../config/env.js';
import { sessionCookieName } from '../../auth/service/authService.js';
import { usernameSchema } from '../../profiles/validation/profileSchemas.js';
import {
  beginGitHubConnection,
  completeGitHubConnection,
  connectionStatus,
  disconnectGitHub,
  listRepositories,
  portfolioForUser,
  publicPortfolio,
  setFeatured,
  syncGitHub
} from '../service/githubService.js';
const id = z.string().regex(/^[0-9a-f]{24}$/i);
const callback = z
  .object({
    code: z.string().max(200).optional(),
    state: z.string().max(100).optional(),
    error: z.string().max(100).optional()
  })
  .strict();
const list = z
  .object({
    search: z.string().trim().max(100).optional(),
    language: z.string().trim().max(100).optional(),
    sort: z.enum(['recently_updated', 'most_starred', 'name']).default('recently_updated'),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().min(1).max(50).optional()
  })
  .strict();
const featured = z
  .object({
    repositoryIds: z
      .array(id)
      .max(6)
      .refine((ids) => new Set(ids).size === ids.length)
  })
  .strict();
const username = z.object({ username: usernameSchema }).strict();
const writes = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  keyGenerator: (request) => authenticatedUser(request).id,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response) => sendFailure(response, 429, 'RATE_LIMITED', 'Too many GitHub actions.')
});
const routes = Router();
routes.use(requireDatabase, requireAllowedOrigin);
routes.get('/portfolio/:username', validateParams(username), async (request, response) =>
  sendSuccess(
    response,
    await publicPortfolio((request.validatedParams as z.infer<typeof username>).username),
    'GitHub portfolio loaded'
  )
);
routes.use(requireAuth, requireVerifiedEmail, requireCompletedOnboarding);
const user = (request: Parameters<typeof authenticatedUser>[0]) => authenticatedUser(request).id;
routes.get('/connection', async (request, response) =>
  sendSuccess(response, await connectionStatus(user(request)), 'GitHub connection loaded')
);
routes.get('/connect', writes, async (request, response) =>
  sendSuccess(
    response,
    await beginGitHubConnection(user(request), request.cookies?.[sessionCookieName]),
    'GitHub authorization ready'
  )
);
routes.get('/callback', validateQuery(callback), async (request, response) => {
  const query = request.validatedQuery as z.infer<typeof callback>;
  const destination = new URL('/app/profile', env.appPublicUrl);
  try {
    if (query.error || !query.code || !query.state) throw new Error('OAuth denied');
    await completeGitHubConnection(
      user(request),
      request.cookies?.[sessionCookieName],
      query.state,
      query.code
    );
    destination.searchParams.set('github', 'connected');
  } catch {
    destination.searchParams.set('github', 'error');
  }
  response.redirect(303, destination.toString());
});
routes.delete('/connection', writes, async (request, response) =>
  sendSuccess(response, await disconnectGitHub(user(request)), 'GitHub disconnected')
);
routes.post('/sync', writes, async (request, response) =>
  sendSuccess(response, await syncGitHub(user(request)), 'GitHub repositories synchronized')
);
routes.get('/repositories', validateQuery(list), async (request, response) =>
  sendSuccess(
    response,
    await listRepositories(user(request), request.validatedQuery as z.infer<typeof list>),
    'Repositories loaded'
  )
);
routes.get('/featured', async (request, response) =>
  sendSuccess(response, await portfolioForUser(user(request)), 'Featured repositories loaded')
);
routes.put('/featured', writes, validateBody(featured), async (request, response) =>
  sendSuccess(
    response,
    await setFeatured(user(request), (request.body as z.infer<typeof featured>).repositoryIds),
    'Featured repositories saved'
  )
);
export default routes;
