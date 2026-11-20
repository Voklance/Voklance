import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { sendFailure, sendSuccess } from '../../../common/apiResponse.js';
import { requireAllowedOrigin } from '../../../middleware/requireAllowedOrigin.js';
import { requireAuth, authenticatedUser } from '../../../middleware/requireAuth.js';
import { requireCompletedOnboarding } from '../../../middleware/requireCompletedOnboarding.js';
import { requireDatabase } from '../../../middleware/requireDatabase.js';
import { requireVerifiedEmail } from '../../../middleware/requireVerifiedEmail.js';
import { validateBody } from '../../../middleware/validateBody.js';
import { validateParams } from '../../../middleware/validateParams.js';
import { validateQuery } from '../../../middleware/validateQuery.js';
import {
  createComment,
  createPost,
  deleteComment,
  deletePost,
  editComment,
  editPost,
  getPost,
  listBookmarks,
  listComments,
  listFeed,
  toggleBookmark,
  toggleLike
} from '../service/postService.js';
import {
  commentBody,
  commentParams,
  pageQuery,
  postBody,
  postParams,
  postPatch,
  type PageQuery
} from '../validation/postSchemas.js';

const writeLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: (request) => authenticatedUser(request).id,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response) =>
    sendFailure(response, 429, 'RATE_LIMITED', 'Too many actions. Please try again later.')
});
const router = Router();
router.use(
  requireDatabase,
  requireAllowedOrigin,
  requireAuth,
  requireVerifiedEmail,
  requireCompletedOnboarding
);
const userId = (request: Parameters<typeof authenticatedUser>[0]) => authenticatedUser(request).id;
const postId = (request: { validatedParams?: unknown }) =>
  (request.validatedParams as { postId: string }).postId;
const commentId = (request: { validatedParams?: unknown }) =>
  (request.validatedParams as { commentId: string }).commentId;
const page = (request: { validatedQuery?: unknown }) => request.validatedQuery as PageQuery;

router.get('/', validateQuery(pageQuery), async (request, response) => {
  sendSuccess(response, await listFeed(userId(request), page(request)), 'Feed loaded');
});
router.post('/', writeLimit, validateBody(postBody), async (request, response) => {
  const post = await createPost(userId(request), (request.body as { content: string }).content);
  sendSuccess(response, { post }, 'Post published', 201);
});
router.get('/:postId', validateParams(postParams), async (request, response) => {
  sendSuccess(response, { post: await getPost(userId(request), postId(request)) }, 'Post loaded');
});
router.patch(
  '/:postId',
  writeLimit,
  validateParams(postParams),
  validateBody(postPatch),
  async (request, response) => {
    const post = await editPost(
      userId(request),
      postId(request),
      (request.body as { content: string }).content
    );
    sendSuccess(response, { post }, 'Post updated');
  }
);
router.delete('/:postId', writeLimit, validateParams(postParams), async (request, response) => {
  await deletePost(userId(request), postId(request));
  sendSuccess(response, {}, 'Post deleted');
});
router.put('/:postId/like', writeLimit, validateParams(postParams), async (request, response) => {
  sendSuccess(response, await toggleLike(userId(request), postId(request), true), 'Post liked');
});
router.delete('/:postId/like', writeLimit, validateParams(postParams), async (request, response) => {
  sendSuccess(response, await toggleLike(userId(request), postId(request), false), 'Post unliked');
});
router.put('/:postId/bookmark', writeLimit, validateParams(postParams), async (request, response) => {
  sendSuccess(response, await toggleBookmark(userId(request), postId(request), true), 'Post saved');
});
router.delete('/:postId/bookmark', writeLimit, validateParams(postParams), async (request, response) => {
  sendSuccess(
    response,
    await toggleBookmark(userId(request), postId(request), false),
    'Post removed from saved'
  );
});
router.get(
  '/:postId/comments',
  validateParams(postParams),
  validateQuery(pageQuery),
  async (request, response) => {
    sendSuccess(
      response,
      await listComments(userId(request), postId(request), page(request)),
      'Comments loaded'
    );
  }
);
router.post(
  '/:postId/comments',
  writeLimit,
  validateParams(postParams),
  validateBody(commentBody),
  async (request, response) => {
    const comment = await createComment(
      userId(request),
      postId(request),
      (request.body as { content: string }).content
    );
    sendSuccess(response, { comment }, 'Comment added', 201);
  }
);
router.patch(
  '/:postId/comments/:commentId',
  writeLimit,
  validateParams(commentParams),
  validateBody(commentBody),
  async (request, response) => {
    const comment = await editComment(
      userId(request),
      postId(request),
      commentId(request),
      (request.body as { content: string }).content
    );
    sendSuccess(response, { comment }, 'Comment updated');
  }
);
router.delete(
  '/:postId/comments/:commentId',
  writeLimit,
  validateParams(commentParams),
  async (request, response) => {
    await deleteComment(userId(request), postId(request), commentId(request));
    sendSuccess(response, {}, 'Comment deleted');
  }
);

export const bookmarkRoutes = Router();
bookmarkRoutes.use(
  requireDatabase,
  requireAllowedOrigin,
  requireAuth,
  requireVerifiedEmail,
  requireCompletedOnboarding
);
bookmarkRoutes.get('/', validateQuery(pageQuery), async (request, response) => {
  sendSuccess(response, await listBookmarks(userId(request), page(request)), 'Saved posts loaded');
});
export default router;
