import { Router, type Request, type RequestHandler, type Response } from 'express';
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
  attendees,
  cancelEvent,
  cancelRegistration,
  editEvent,
  eventDetail,
  listEvents,
  register,
  setRSVP
} from '../service/eventService.js';
import {
  attendeeQuery,
  communityEventParams,
  eventListQuery,
  eventParams,
  eventPatchBody,
  rsvpBody,
  type AttendeeQuery,
  type EventListQuery
} from '../validation/eventSchemas.js';

const access: RequestHandler[] = [
  requireDatabase,
  requireAllowedOrigin,
  requireAuth,
  requireVerifiedEmail,
  requireCompletedOnboarding
];
const writeLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  keyGenerator: (request) => authenticatedUser(request).id,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response) =>
    sendFailure(response, 429, 'RATE_LIMITED', 'Too many event actions. Please try again later.')
});
const id = (request: Request) => authenticatedUser(request).id;
const param = (request: Request, name: string) => (request.validatedParams as Record<string, string>)[name];
export const eventRoutes = Router();
export const communityEventRoutes = Router();
eventRoutes.get('/', access, validateQuery(eventListQuery), async (request: Request, response: Response) => {
  sendSuccess(
    response,
    await listEvents(id(request), request.validatedQuery as EventListQuery),
    'Events loaded'
  );
});
eventRoutes.get(
  '/:eventId',
  access,
  validateParams(eventParams),
  async (request: Request, response: Response) => {
    sendSuccess(
      response,
      { event: await eventDetail(param(request, 'eventId'), id(request)) },
      'Event loaded'
    );
  }
);
eventRoutes.patch(
  '/:eventId',
  access,
  writeLimit,
  validateParams(eventParams),
  validateBody(eventPatchBody),
  async (request: Request, response: Response) => {
    sendSuccess(
      response,
      { event: await editEvent(param(request, 'eventId'), id(request), request.body) },
      'Event updated'
    );
  }
);
eventRoutes.post(
  '/:eventId/cancel',
  access,
  writeLimit,
  validateParams(eventParams),
  async (request: Request, response: Response) => {
    sendSuccess(
      response,
      { event: await cancelEvent(param(request, 'eventId'), id(request)) },
      'Event cancelled'
    );
  }
);
eventRoutes.post(
  '/:eventId/register',
  access,
  writeLimit,
  validateParams(eventParams),
  async (request: Request, response: Response) => {
    sendSuccess(response, { event: await register(param(request, 'eventId'), id(request)) }, 'Registered');
  }
);
eventRoutes.delete(
  '/:eventId/registration',
  access,
  writeLimit,
  validateParams(eventParams),
  async (request: Request, response: Response) => {
    sendSuccess(
      response,
      { event: await cancelRegistration(param(request, 'eventId'), id(request)) },
      'Registration cancelled'
    );
  }
);
eventRoutes.put(
  '/:eventId/rsvp',
  access,
  writeLimit,
  validateParams(eventParams),
  validateBody(rsvpBody),
  async (request: Request, response: Response) => {
    sendSuccess(
      response,
      { event: await setRSVP(param(request, 'eventId'), id(request), request.body.response) },
      'RSVP updated'
    );
  }
);
eventRoutes.get(
  '/:eventId/attendees',
  access,
  validateParams(eventParams),
  validateQuery(attendeeQuery),
  async (request: Request, response: Response) => {
    sendSuccess(
      response,
      await attendees(param(request, 'eventId'), id(request), request.validatedQuery as AttendeeQuery),
      'Attendees loaded'
    );
  }
);
communityEventRoutes.get(
  '/:communityId/events',
  access,
  validateParams(communityEventParams),
  validateQuery(eventListQuery.omit({ communityId: true, mine: true })),
  async (request: Request, response: Response) => {
    sendSuccess(
      response,
      await listEvents(id(request), {
        ...(request.validatedQuery as EventListQuery),
        communityId: param(request, 'communityId')
      }),
      'Community events loaded'
    );
  }
);
