import { BOOKMARK_TYPES } from '@voklance/shared';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { sendFailure, sendSuccess } from '../../../common/apiResponse.js';
import { AppError } from '../../../common/AppError.js';
import { authenticatedUser, requireAuth } from '../../../middleware/requireAuth.js';
import { requireAllowedOrigin } from '../../../middleware/requireAllowedOrigin.js';
import { requireCompletedOnboarding } from '../../../middleware/requireCompletedOnboarding.js';
import { requireDatabase } from '../../../middleware/requireDatabase.js';
import { requireVerifiedEmail } from '../../../middleware/requireVerifiedEmail.js';
import { validateBody } from '../../../middleware/validateBody.js';
import { validateParams } from '../../../middleware/validateParams.js';
import { validateQuery } from '../../../middleware/validateQuery.js';
import {
  addCollectionItem,
  bookmarkStatus,
  createCollection,
  deleteCollection,
  listCollections,
  listSavedItems,
  removeBookmark,
  removeCollectionItem,
  saveBookmark,
  updateCollection
} from '../service/bookmarkService.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const entity = z.object({ entityType: z.enum(BOOKMARK_TYPES), entityId: objectId });
const bookmarkId = z.object({ bookmarkId: objectId });
const collectionId = z.object({ collectionId: objectId });
const memberId = z.object({ collectionId: objectId, bookmarkId: objectId });
const savedQuery = z.object({
  type: z.enum(BOOKMARK_TYPES).optional(),
  collectionId: objectId.optional(),
  search: z.string().trim().max(100).optional(),
  sort: z.enum(['recent', 'oldest', 'published']).default('recent'),
  cursor: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(40).default(20)
});
const collectionQuery = z.object({
  limit: z.coerce.number().int().min(1).max(40).default(20),
  cursor: objectId.optional()
});
const collectionBody = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240).default('')
});
const collectionPatch = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(240).optional()
  })
  .refine((value) => Object.keys(value).length > 0);
const statusQuery = z.object({ entities: z.string().max(2500) });
const user = (request: Parameters<typeof authenticatedUser>[0]) => authenticatedUser(request).id;
const writeLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 60,
  keyGenerator: (request) => user(request),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response) =>
    sendFailure(response, 429, 'RATE_LIMITED', 'Too many saved-item changes. Try again later.')
});
const router = Router();
router.use(
  requireDatabase,
  requireAllowedOrigin,
  requireAuth,
  requireVerifiedEmail,
  requireCompletedOnboarding
);
router.get('/status', validateQuery(statusQuery), async (request, response) => {
  const parsed = (request.validatedQuery as { entities: string }).entities.split(',').filter(Boolean);
  const checked = z
    .array(entity)
    .max(40)
    .safeParse(
      parsed.map((part) => {
        const [entityType, entityId, ...rest] = part.split(':');
        return rest.length ? {} : { entityType, entityId };
      })
    );
  if (!checked.success) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid bookmark status query.');
  sendSuccess(response, await bookmarkStatus(user(request), checked.data), 'Bookmark status loaded');
});
router.get('/', validateQuery(savedQuery), async (request, response) =>
  sendSuccess(
    response,
    await listSavedItems(user(request), request.validatedQuery as z.infer<typeof savedQuery>),
    'Saved items loaded'
  )
);
router.post('/', writeLimit, validateBody(entity), async (request, response) =>
  sendSuccess(
    response,
    await saveBookmark(user(request), request.body.entityType, request.body.entityId),
    'Item saved',
    201
  )
);
router.delete('/:bookmarkId', writeLimit, validateParams(bookmarkId), async (request, response) =>
  sendSuccess(
    response,
    await removeBookmark(user(request), (request.validatedParams as z.infer<typeof bookmarkId>).bookmarkId),
    'Item removed'
  )
);
export default router;

export const collectionRoutes = Router();
collectionRoutes.use(
  requireDatabase,
  requireAllowedOrigin,
  requireAuth,
  requireVerifiedEmail,
  requireCompletedOnboarding
);
collectionRoutes.get('/', validateQuery(collectionQuery), async (request, response) => {
  const query = request.validatedQuery as z.infer<typeof collectionQuery>;
  sendSuccess(
    response,
    await listCollections(user(request), query.limit, query.cursor),
    'Collections loaded'
  );
});
collectionRoutes.post('/', writeLimit, validateBody(collectionBody), async (request, response) =>
  sendSuccess(
    response,
    await createCollection(user(request), request.body.name, request.body.description),
    'Collection created',
    201
  )
);
collectionRoutes.patch(
  '/:collectionId',
  writeLimit,
  validateParams(collectionId),
  validateBody(collectionPatch),
  async (request, response) =>
    sendSuccess(
      response,
      await updateCollection(
        user(request),
        (request.validatedParams as z.infer<typeof collectionId>).collectionId,
        request.body
      ),
      'Collection updated'
    )
);
collectionRoutes.delete(
  '/:collectionId',
  writeLimit,
  validateParams(collectionId),
  async (request, response) =>
    sendSuccess(
      response,
      await deleteCollection(
        user(request),
        (request.validatedParams as z.infer<typeof collectionId>).collectionId
      ),
      'Collection removed'
    )
);
collectionRoutes.put(
  '/:collectionId/items/:bookmarkId',
  writeLimit,
  validateParams(memberId),
  async (request, response) => {
    const ids = request.validatedParams as z.infer<typeof memberId>;
    sendSuccess(
      response,
      await addCollectionItem(user(request), ids.collectionId, ids.bookmarkId),
      'Item added to collection'
    );
  }
);
collectionRoutes.delete(
  '/:collectionId/items/:bookmarkId',
  writeLimit,
  validateParams(memberId),
  async (request, response) => {
    const ids = request.validatedParams as z.infer<typeof memberId>;
    sendSuccess(
      response,
      await removeCollectionItem(user(request), ids.collectionId, ids.bookmarkId),
      'Item removed from collection'
    );
  }
);
