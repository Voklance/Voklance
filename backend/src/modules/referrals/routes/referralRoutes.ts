import { Router, type Request, type RequestHandler, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import type {
  ApplicationStatus,
  NeedReferralPayload,
  OfferStatus,
  ReferralApplicationInput,
  ReferralOfferInput,
  ReferralPayload
} from '@voklance/shared';
import { sendFailure, sendSuccess as standardSuccess } from '../../../common/apiResponse.js';
import { requireAllowedOrigin } from '../../../middleware/requireAllowedOrigin.js';
import { authenticatedUser, requireAuth } from '../../../middleware/requireAuth.js';
import { requireCompletedOnboarding } from '../../../middleware/requireCompletedOnboarding.js';
import { requireDatabase } from '../../../middleware/requireDatabase.js';
import { requireVerifiedEmail } from '../../../middleware/requireVerifiedEmail.js';
import { validateBody } from '../../../middleware/validateBody.js';
import { validateParams } from '../../../middleware/validateParams.js';
import { validateQuery } from '../../../middleware/validateQuery.js';
import {
  closeReferral,
  fulfillNeed,
  getReferral,
  listCommunityReferrals,
  myPublished,
  updateReferral
} from '../service/referralService.js';
import {
  applyForReferral,
  listApplications,
  listOffers,
  myApplications,
  myOffers,
  offerReferral,
  updateApplicationStatus,
  updateOfferStatus
} from '../service/responseService.js';
import {
  applicationBody,
  applicationParams,
  applicationStatusBody,
  communityIdParams,
  needParams,
  needUpdateBody,
  offerBody,
  offerParams,
  offerStatusBody,
  opportunityParams,
  opportunityUpdateBody,
  referralPageQuery,
  responsePageQuery,
  type ReferralPageQuery,
  type ResponsePageQuery
} from '../validation/referralSchemas.js';

const access: RequestHandler[] = [
  requireDatabase,
  requireAllowedOrigin,
  requireAuth,
  requireVerifiedEmail,
  requireCompletedOnboarding
];
const writes = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: (request) => authenticatedUser(request).id,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response) =>
    sendFailure(response, 429, 'RATE_LIMITED', 'Too many referral actions. Please try again later.')
});
const actor = (request: Request) => authenticatedUser(request).id;
const sendSuccess = <T>(response: Response, data: T, message = 'Referral data loaded', status = 200) =>
  standardSuccess(response, data, message, status);
const param = (request: Request, key: string) => (request.validatedParams as Record<string, string>)[key];
const listing = (request: Request) => request.validatedQuery as ReferralPageQuery;
const paging = (request: Request) => request.validatedQuery as ResponsePageQuery;

export const communityReferralRoutes = Router();
communityReferralRoutes.get(
  '/:communityId/referrals',
  access,
  validateParams(communityIdParams),
  validateQuery(referralPageQuery),
  async (request: Request, response: Response) => {
    sendSuccess(
      response,
      await listCommunityReferrals(
        param(request, 'communityId'),
        actor(request),
        'referral',
        listing(request)
      )
    );
  }
);
communityReferralRoutes.get(
  '/:communityId/referral-needs',
  access,
  validateParams(communityIdParams),
  validateQuery(referralPageQuery),
  async (request: Request, response: Response) => {
    sendSuccess(
      response,
      await listCommunityReferrals(
        param(request, 'communityId'),
        actor(request),
        'needreferral',
        listing(request)
      )
    );
  }
);

const router = Router();
router.use(...access);
router.get(
  '/opportunities/me',
  validateQuery(responsePageQuery),
  async (request: Request, response: Response) =>
    sendSuccess(response, await myPublished(actor(request), 'referral', paging(request)))
);
router.get('/needs/me', validateQuery(responsePageQuery), async (request: Request, response: Response) =>
  sendSuccess(response, await myPublished(actor(request), 'needreferral', paging(request)))
);
router.get(
  '/applications/me',
  validateQuery(responsePageQuery),
  async (request: Request, response: Response) =>
    sendSuccess(response, await myApplications(actor(request), paging(request)))
);
router.get('/offers/me', validateQuery(responsePageQuery), async (request: Request, response: Response) =>
  sendSuccess(response, await myOffers(actor(request), paging(request)))
);

router.get(
  '/opportunities/:opportunityId',
  validateParams(opportunityParams),
  async (request: Request, response: Response) =>
    sendSuccess(response, {
      opportunity: await getReferral(param(request, 'opportunityId'), actor(request), 'referral')
    })
);
router.patch(
  '/opportunities/:opportunityId',
  writes,
  validateParams(opportunityParams),
  validateBody(opportunityUpdateBody),
  async (request: Request, response: Response) =>
    sendSuccess(response, {
      opportunity: await updateReferral(
        param(request, 'opportunityId'),
        actor(request),
        'referral',
        request.body.details as ReferralPayload
      )
    })
);
router.post(
  '/opportunities/:opportunityId/close',
  writes,
  validateParams(opportunityParams),
  async (request: Request, response: Response) =>
    sendSuccess(response, {
      opportunity: await closeReferral(param(request, 'opportunityId'), actor(request), 'referral')
    })
);
router.post(
  '/opportunities/:opportunityId/applications',
  writes,
  validateParams(opportunityParams),
  validateBody(applicationBody),
  async (request: Request, response: Response) =>
    sendSuccess(
      response,
      {
        application: await applyForReferral(
          param(request, 'opportunityId'),
          actor(request),
          request.body as ReferralApplicationInput
        )
      },
      'Referral requested',
      201
    )
);
router.get(
  '/opportunities/:opportunityId/applications',
  validateParams(opportunityParams),
  validateQuery(responsePageQuery),
  async (request: Request, response: Response) =>
    sendSuccess(
      response,
      await listApplications(param(request, 'opportunityId'), actor(request), paging(request))
    )
);
router.patch(
  '/applications/:applicationId/status',
  writes,
  validateParams(applicationParams),
  validateBody(applicationStatusBody),
  async (request: Request, response: Response) =>
    sendSuccess(response, {
      application: await updateApplicationStatus(
        param(request, 'applicationId'),
        actor(request),
        request.body.status as ApplicationStatus
      )
    })
);

router.get('/needs/:needId', validateParams(needParams), async (request: Request, response: Response) =>
  sendSuccess(response, { need: await getReferral(param(request, 'needId'), actor(request), 'needreferral') })
);
router.patch(
  '/needs/:needId',
  writes,
  validateParams(needParams),
  validateBody(needUpdateBody),
  async (request: Request, response: Response) =>
    sendSuccess(response, {
      need: await updateReferral(
        param(request, 'needId'),
        actor(request),
        'needreferral',
        request.body.details as NeedReferralPayload
      )
    })
);
router.post(
  '/needs/:needId/close',
  writes,
  validateParams(needParams),
  async (request: Request, response: Response) =>
    sendSuccess(response, {
      need: await closeReferral(param(request, 'needId'), actor(request), 'needreferral')
    })
);
router.post(
  '/needs/:needId/fulfill',
  writes,
  validateParams(needParams),
  async (request: Request, response: Response) =>
    sendSuccess(response, { need: await fulfillNeed(param(request, 'needId'), actor(request)) })
);
router.post(
  '/needs/:needId/offers',
  writes,
  validateParams(needParams),
  validateBody(offerBody),
  async (request: Request, response: Response) =>
    sendSuccess(
      response,
      {
        offer: await offerReferral(
          param(request, 'needId'),
          actor(request),
          request.body as ReferralOfferInput
        )
      },
      'Referral offered',
      201
    )
);
router.get(
  '/needs/:needId/offers',
  validateParams(needParams),
  validateQuery(responsePageQuery),
  async (request: Request, response: Response) =>
    sendSuccess(response, await listOffers(param(request, 'needId'), actor(request), paging(request)))
);
router.patch(
  '/offers/:offerId/status',
  writes,
  validateParams(offerParams),
  validateBody(offerStatusBody),
  async (request: Request, response: Response) =>
    sendSuccess(response, {
      offer: await updateOfferStatus(
        param(request, 'offerId'),
        actor(request),
        request.body.status as OfferStatus
      )
    })
);
export default router;
