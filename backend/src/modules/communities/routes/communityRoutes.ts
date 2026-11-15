import { Router, type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { getCurrentUser, sessionCookieName } from '../../auth/service/authService.js';
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
  archiveCommunity,
  createCommunity,
  decideRequest,
  discoverCommunities,
  getCommunity,
  joinCommunity,
  leaveCommunity,
  members,
  myCommunities,
  removeMember,
  requests,
  transferOwnership,
  updateCommunity,
  updateMemberRole
} from '../service/communityService.js';
import {
  communityIdParams,
  communitySlugParams,
  createCommunityBody,
  discoverQuery,
  memberParams,
  pageQuery,
  requestParams,
  roleBody,
  transferBody,
  updateCommunityBody,
  type CommunityDiscover,
  type CommunityPageQuery
} from '../validation/communitySchemas.js';

const optionalAuth: RequestHandler = async (request, _response, next) => {
  const token = request.cookies?.[sessionCookieName];
  if (typeof token === 'string') request.authUser = await getCurrentUser(token);
  next();
};
const writeLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: (request) => authenticatedUser(request).id,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response) =>
    sendFailure(response, 429, 'RATE_LIMITED', 'Too many community actions. Please try again later.')
});
const protectedAccess = [requireAuth, requireVerifiedEmail, requireCompletedOnboarding];
const userId = (request: Parameters<typeof authenticatedUser>[0]) => authenticatedUser(request).id;
const param = (request: { validatedParams?: unknown }, key: string) =>
  (request.validatedParams as Record<string, string>)[key];
const listQuery = (request: { validatedQuery?: unknown }) => request.validatedQuery as CommunityPageQuery;

const router = Router();
router.use(requireDatabase, requireAllowedOrigin);
router.get('/', optionalAuth, validateQuery(discoverQuery), async (request, response) => {
  sendSuccess(
    response,
    await discoverCommunities(request.authUser?.id ?? '', request.validatedQuery as CommunityDiscover),
    'Communities loaded'
  );
});
router.get('/:slug', optionalAuth, validateParams(communitySlugParams), async (request, response) => {
  sendSuccess(
    response,
    { community: await getCommunity(param(request, 'slug'), request.authUser?.id ?? '') },
    'Community loaded'
  );
});
router.use(...protectedAccess);
router.post('/', writeLimit, validateBody(createCommunityBody), async (request, response) => {
  sendSuccess(
    response,
    { community: await createCommunity(userId(request), request.body) },
    'Community created',
    201
  );
});
router.post(
  '/:communityId/join',
  writeLimit,
  validateParams(communityIdParams),
  async (request, response) => {
    sendSuccess(
      response,
      await joinCommunity(param(request, 'communityId'), userId(request)),
      'Membership updated'
    );
  }
);
router.delete(
  '/:communityId/membership',
  writeLimit,
  validateParams(communityIdParams),
  async (request, response) => {
    sendSuccess(
      response,
      await leaveCommunity(param(request, 'communityId'), userId(request)),
      'Membership ended'
    );
  }
);
router.get(
  '/:communityId/members',
  validateParams(communityIdParams),
  validateQuery(pageQuery),
  async (request, response) => {
    sendSuccess(
      response,
      await members(param(request, 'communityId'), userId(request), listQuery(request)),
      'Members loaded'
    );
  }
);
router.get(
  '/:communityId/membership-requests',
  validateParams(communityIdParams),
  validateQuery(pageQuery),
  async (request, response) => {
    sendSuccess(
      response,
      await requests(param(request, 'communityId'), userId(request), listQuery(request)),
      'Requests loaded'
    );
  }
);
router.post(
  '/:communityId/membership-requests/:requestId/approve',
  writeLimit,
  validateParams(requestParams),
  async (request, response) => {
    sendSuccess(
      response,
      await decideRequest(param(request, 'communityId'), param(request, 'requestId'), userId(request), true),
      'Request approved'
    );
  }
);
router.post(
  '/:communityId/membership-requests/:requestId/reject',
  writeLimit,
  validateParams(requestParams),
  async (request, response) => {
    sendSuccess(
      response,
      await decideRequest(param(request, 'communityId'), param(request, 'requestId'), userId(request), false),
      'Request rejected'
    );
  }
);
router.patch(
  '/:communityId',
  writeLimit,
  validateParams(communityIdParams),
  validateBody(updateCommunityBody),
  async (request, response) => {
    sendSuccess(
      response,
      { community: await updateCommunity(param(request, 'communityId'), userId(request), request.body) },
      'Community updated'
    );
  }
);
router.patch(
  '/:communityId/members/:userId/role',
  writeLimit,
  validateParams(memberParams),
  validateBody(roleBody),
  async (request, response) => {
    sendSuccess(
      response,
      await updateMemberRole(
        param(request, 'communityId'),
        userId(request),
        param(request, 'userId'),
        request.body.role
      ),
      'Role updated'
    );
  }
);
router.delete(
  '/:communityId/members/:userId',
  writeLimit,
  validateParams(memberParams),
  async (request, response) => {
    sendSuccess(
      response,
      await removeMember(param(request, 'communityId'), userId(request), param(request, 'userId')),
      'Member removed'
    );
  }
);
router.post(
  '/:communityId/transfer-ownership',
  writeLimit,
  validateParams(communityIdParams),
  validateBody(transferBody),
  async (request, response) => {
    sendSuccess(
      response,
      {
        community: await transferOwnership(
          param(request, 'communityId'),
          userId(request),
          request.body.newOwnerUserId
        )
      },
      'Ownership transferred'
    );
  }
);
router.post(
  '/:communityId/archive',
  writeLimit,
  validateParams(communityIdParams),
  async (request, response) => {
    sendSuccess(
      response,
      { community: await archiveCommunity(param(request, 'communityId'), userId(request)) },
      'Community archived'
    );
  }
);

export const myCommunityRoutes = Router();
myCommunityRoutes.use(requireDatabase, requireAllowedOrigin, ...protectedAccess);
myCommunityRoutes.get('/', validateQuery(pageQuery), async (request, response) => {
  sendSuccess(
    response,
    await myCommunities(userId(request), listQuery(request)),
    'Joined communities loaded'
  );
});
export default router;
