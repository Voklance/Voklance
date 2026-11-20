import { Router } from 'express';
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
import { discoverProfessionals } from '../service/professionalDiscoveryService.js';
import {
  listConnections,
  listRequests,
  networkCounts,
  profileNetwork,
  relativeStatus,
  resolveRecipient,
  sendRequest,
  transition,
  visibleConnections
} from '../service/connectionService.js';
import {
  connectionParams,
  discoveryQuery,
  pageQuery,
  requestBody,
  requestParams,
  statusParams,
  usernameParams,
  type DiscoveryQuery,
  type PageQuery
} from '../validation/connectionSchemas.js';

const sendLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  keyGenerator: (request) => authenticatedUser(request).id,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response) =>
    sendFailure(response, 429, 'RATE_LIMITED', 'Too many connection requests. Please try again later.')
});
const changesLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  keyGenerator: (request) => authenticatedUser(request).id,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response) =>
    sendFailure(response, 429, 'RATE_LIMITED', 'Too many network actions. Please try again later.')
});
const guard = [
  requireDatabase,
  requireAllowedOrigin,
  requireAuth,
  requireVerifiedEmail,
  requireCompletedOnboarding
];
const viewer = (request: Parameters<typeof authenticatedUser>[0]) => authenticatedUser(request).id;
export const connectionRoutes = Router();
connectionRoutes.use(...guard);
connectionRoutes.get('/counts', async (request, response) =>
  sendSuccess(response, { counts: await networkCounts(viewer(request)) }, 'Network counts loaded')
);
connectionRoutes.get('/me', validateQuery(pageQuery), async (request, response) =>
  sendSuccess(
    response,
    await listConnections(viewer(request), request.validatedQuery as PageQuery),
    'Connections loaded'
  )
);
connectionRoutes.get('/requests/incoming', validateQuery(pageQuery), async (request, response) =>
  sendSuccess(
    response,
    await listRequests(viewer(request), 'incoming', request.validatedQuery as PageQuery),
    'Incoming requests loaded'
  )
);
connectionRoutes.get('/requests/sent', validateQuery(pageQuery), async (request, response) =>
  sendSuccess(
    response,
    await listRequests(viewer(request), 'sent', request.validatedQuery as PageQuery),
    'Sent requests loaded'
  )
);
connectionRoutes.post('/requests', sendLimit, validateBody(requestBody), async (request, response) => {
  const recipientId = await resolveRecipient(
    request.body as { recipientId?: string; recipientUsername?: string }
  );
  sendSuccess(
    response,
    { connection: await sendRequest(viewer(request), recipientId) },
    'Connection request sent',
    201
  );
});
for (const action of ['accept', 'decline'] as const)
  connectionRoutes.post(
    `/requests/:requestId/${action}`,
    changesLimit,
    validateParams(requestParams),
    async (request, response) =>
      sendSuccess(
        response,
        {
          connection: await transition(
            viewer(request),
            (request.validatedParams as { requestId: string }).requestId,
            action
          )
        },
        action === 'accept' ? 'Request accepted' : 'Request declined'
      )
  );
connectionRoutes.delete(
  '/requests/:requestId',
  changesLimit,
  validateParams(requestParams),
  async (request, response) =>
    sendSuccess(
      response,
      {
        connection: await transition(
          viewer(request),
          (request.validatedParams as { requestId: string }).requestId,
          'cancel'
        )
      },
      'Request cancelled'
    )
);
connectionRoutes.get(
  '/status/by-username/:username',
  validateParams(usernameParams),
  async (request, response) =>
    sendSuccess(
      response,
      await profileNetwork(viewer(request), (request.validatedParams as { username: string }).username),
      'Connection status loaded'
    )
);
connectionRoutes.get('/status/:userId', validateParams(statusParams), async (request, response) =>
  sendSuccess(
    response,
    await relativeStatus(viewer(request), (request.validatedParams as { userId: string }).userId),
    'Connection status loaded'
  )
);
connectionRoutes.get(
  '/users/:username',
  validateParams(usernameParams),
  validateQuery(pageQuery),
  async (request, response) =>
    sendSuccess(
      response,
      await visibleConnections(
        viewer(request),
        (request.validatedParams as { username: string }).username,
        request.validatedQuery as PageQuery
      ),
      'Visible connections loaded'
    )
);
connectionRoutes.delete(
  '/:connectionId',
  changesLimit,
  validateParams(connectionParams),
  async (request, response) =>
    sendSuccess(
      response,
      {
        connection: await transition(
          viewer(request),
          (request.validatedParams as { connectionId: string }).connectionId,
          'remove'
        )
      },
      'Connection removed'
    )
);

export const professionalDiscoveryRoutes = Router();
professionalDiscoveryRoutes.use(...guard);
professionalDiscoveryRoutes.get('/', validateQuery(discoveryQuery), async (request, response) =>
  sendSuccess(
    response,
    await discoverProfessionals(viewer(request), request.validatedQuery as DiscoveryQuery),
    'Professionals loaded'
  )
);
