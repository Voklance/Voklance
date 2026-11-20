import { Router, type Request, type RequestHandler, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { RESOURCE_CATEGORIES, RESOURCE_FILE_TYPES, RESOURCE_MAX_FILE_BYTES } from '@voklance/shared';
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
  checkDownloadAccess,
  checkUploadAccess,
  deleteResource,
  editResource,
  listCommunityResources,
  listMyResources,
  listReports,
  reportResource,
  resourceDetail,
  reviewReport
} from '../service/resourceService.js';
import {
  communityParams,
  patchBody,
  reportBody,
  reportParams,
  reportQuery,
  resourceParams,
  resourceQuery,
  reviewBody,
  uploadQuery,
  type ReportQuery,
  type ResourceQuery
} from '../validation/resourceSchemas.js';

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
    sendFailure(response, 429, 'RATE_LIMITED', 'Too many resource actions. Please try again later.')
});
const actor = (request: Request) => authenticatedUser(request).id;
const param = (request: Request, key: string) => (request.validatedParams as Record<string, string>)[key];
export const resourceRoutes = Router();
export const communityResourceRoutes = Router();
communityResourceRoutes.get(
  '/:communityId/resources',
  access,
  validateParams(communityParams),
  validateQuery(resourceQuery),
  async (request: Request, response: Response) => {
    sendSuccess(
      response,
      await listCommunityResources(
        param(request, 'communityId'),
        actor(request),
        request.validatedQuery as ResourceQuery
      ),
      'Resources loaded'
    );
  }
);
communityResourceRoutes.get(
  '/:communityId/resource-reports',
  access,
  validateParams(communityParams),
  validateQuery(reportQuery),
  async (request: Request, response: Response) => {
    sendSuccess(
      response,
      await listReports(param(request, 'communityId'), actor(request), request.validatedQuery as ReportQuery),
      'Reports loaded'
    );
  }
);
resourceRoutes.get('/capabilities', access, (_request: Request, response: Response) => {
  sendSuccess(
    response,
    {
      uploadAvailable: false,
      publicationAvailable: false,
      scanningAvailable: false,
      previewAvailable: false,
      maxFileBytes: RESOURCE_MAX_FILE_BYTES,
      maxFilesPerResource: 1,
      fileTypes: RESOURCE_FILE_TYPES,
      categories: RESOURCE_CATEGORIES
    },
    'Resource capabilities loaded'
  );
});
resourceRoutes.post('/uploads', access, writes, validateQuery(uploadQuery), async (request: Request) => {
  await checkUploadAccess((request.validatedQuery as { communityId: string }).communityId, actor(request));
});
resourceRoutes.get(
  '/mine',
  access,
  validateQuery(resourceQuery),
  async (request: Request, response: Response) => {
    sendSuccess(
      response,
      await listMyResources(actor(request), request.validatedQuery as ResourceQuery),
      'My resources loaded'
    );
  }
);
resourceRoutes.patch(
  '/reports/:reportId',
  access,
  writes,
  validateParams(reportParams),
  validateBody(reviewBody),
  async (request: Request, response: Response) => {
    sendSuccess(
      response,
      { report: await reviewReport(param(request, 'reportId'), actor(request), request.body.decision) },
      'Report reviewed'
    );
  }
);
resourceRoutes.get(
  '/:resourceId',
  access,
  validateParams(resourceParams),
  async (request: Request, response: Response) => {
    sendSuccess(
      response,
      { resource: await resourceDetail(param(request, 'resourceId'), actor(request)) },
      'Resource loaded'
    );
  }
);
resourceRoutes.get(
  '/:resourceId/download',
  access,
  validateParams(resourceParams),
  async (request: Request) => {
    await checkDownloadAccess(param(request, 'resourceId'), actor(request));
  }
);
resourceRoutes.get(
  '/:resourceId/preview',
  access,
  validateParams(resourceParams),
  async (request: Request) => {
    await checkDownloadAccess(param(request, 'resourceId'), actor(request));
  }
);
resourceRoutes.patch(
  '/:resourceId',
  access,
  writes,
  validateParams(resourceParams),
  validateBody(patchBody),
  async (request: Request, response: Response) => {
    sendSuccess(
      response,
      { resource: await editResource(param(request, 'resourceId'), actor(request), request.body) },
      'Resource updated'
    );
  }
);
resourceRoutes.delete(
  '/:resourceId',
  access,
  writes,
  validateParams(resourceParams),
  async (request: Request, response: Response) => {
    await deleteResource(param(request, 'resourceId'), actor(request));
    sendSuccess(response, {}, 'Resource deleted');
  }
);
resourceRoutes.post(
  '/:resourceId/report',
  access,
  writes,
  validateParams(resourceParams),
  validateBody(reportBody),
  async (request: Request, response: Response) => {
    sendSuccess(
      response,
      { report: await reportResource(param(request, 'resourceId'), actor(request), request.body) },
      'Report submitted',
      201
    );
  }
);
