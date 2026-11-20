import { FEED_MODES, RECOMMENDATION_CATEGORIES } from '@voklance/shared';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { Types } from 'mongoose';
import { z } from 'zod';
import { AppError } from '../../../common/AppError.js';
import { sendFailure, sendSuccess } from '../../../common/apiResponse.js';
import { requireAllowedOrigin } from '../../../middleware/requireAllowedOrigin.js';
import { authenticatedUser, requireAuth } from '../../../middleware/requireAuth.js';
import { requireCompletedOnboarding } from '../../../middleware/requireCompletedOnboarding.js';
import { requireDatabase } from '../../../middleware/requireDatabase.js';
import { requireVerifiedEmail } from '../../../middleware/requireVerifiedEmail.js';
import { validateBody } from '../../../middleware/validateBody.js';
import { validateParams } from '../../../middleware/validateParams.js';
import { validateQuery } from '../../../middleware/validateQuery.js';
import { getPost } from '../../posts/service/postService.js';
import RecommendationFeedback from '../model/RecommendationFeedback.js';
import { recommendedFeed } from '../service/recommendedFeedService.js';
import {
  feedPreferences,
  recommendationPage,
  saveFeedPreferences
} from '../service/recommendationService.js';

const page = z
  .object({
    limit: z.coerce.number().int().min(1).max(30).default(12),
    cursor: z.string().min(1).max(300).optional()
  })
  .strict();
const preferences = z
  .object({
    topics: z
      .array(
        z
          .string()
          .trim()
          .min(2)
          .max(40)
          .regex(/^[a-z0-9]+(?:[ -][a-z0-9]+)*$/i)
      )
      .max(12)
  })
  .strict();
const feedbackBody = z.discriminatedUnion('entityType', [
  z
    .object({
      entityType: z.literal('post'),
      entityId: z.string().regex(/^[0-9a-f]{24}$/i),
      action: z.enum(['hidden', 'not_interested'])
    })
    .strict(),
  z
    .object({
      entityType: z.enum(RECOMMENDATION_CATEGORIES),
      entityId: z.string().regex(/^[0-9a-f]{24}$/i),
      action: z.literal('dismissed')
    })
    .strict()
]);
const idParams = z.object({ feedbackId: z.string().regex(/^[0-9a-f]{24}$/i) }).strict();
const categoryParams = z.object({ category: z.enum(RECOMMENDATION_CATEGORIES) }).strict();
const modeParams = z.object({ mode: z.enum(FEED_MODES) }).strict();
const limiter = rateLimit({
  windowMs: 60_000,
  limit: 40,
  keyGenerator: (request) => authenticatedUser(request).id,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response) =>
    sendFailure(response, 429, 'RATE_LIMITED', 'Too many recommendation requests.')
});
const access = [
  requireDatabase,
  requireAllowedOrigin,
  requireAuth,
  requireVerifiedEmail,
  requireCompletedOnboarding,
  limiter
];
export const feedRoutes = Router();
feedRoutes.use(...access);
feedRoutes.get('/:mode', validateParams(modeParams), validateQuery(page), async (request, response) => {
  const { mode } = request.validatedParams as z.infer<typeof modeParams>;
  const { limit, cursor } = request.validatedQuery as z.infer<typeof page>;
  sendSuccess(
    response,
    await recommendedFeed(authenticatedUser(request).id, mode, limit, cursor),
    'Feed loaded'
  );
});
const router = Router();
router.use(...access);
router.get('/preferences', async (request, response) =>
  sendSuccess(
    response,
    { preferences: await feedPreferences(authenticatedUser(request).id) },
    'Feed preferences loaded'
  )
);
router.patch('/preferences', validateBody(preferences), async (request, response) =>
  sendSuccess(
    response,
    {
      preferences: await saveFeedPreferences(
        authenticatedUser(request).id,
        (request.body as z.infer<typeof preferences>).topics
      )
    },
    'Feed preferences saved'
  )
);
router.post('/feedback', validateBody(feedbackBody), async (request, response) => {
  const userId = authenticatedUser(request).id;
  const input = request.body as z.infer<typeof feedbackBody>;
  const existing = await RecommendationFeedback.findOne({
    userId: new Types.ObjectId(userId),
    ...input
  }).lean();
  if (existing) return sendSuccess(response, { id: existing._id.toString() }, 'Feedback saved');
  if (input.entityType === 'post') await getPost(userId, input.entityId);
  else {
    const candidates = await recommendationPage(userId, input.entityType, 120);
    if (!candidates.items.some((item) => item.id === `${input.entityType}:${input.entityId}`))
      throw new AppError(404, 'RECOMMENDATION_NOT_FOUND', 'Recommendation unavailable.');
  }
  const feedback = await RecommendationFeedback.findOneAndUpdate(
    { userId: new Types.ObjectId(userId), ...input },
    { $setOnInsert: { userId: new Types.ObjectId(userId), ...input } },
    { upsert: true, new: true }
  );
  sendSuccess(response, { id: feedback!._id.toString() }, 'Feedback saved');
});
router.delete('/feedback/:feedbackId', validateParams(idParams), async (request, response) => {
  const { feedbackId } = request.validatedParams as z.infer<typeof idParams>;
  const deleted = await RecommendationFeedback.findOneAndDelete({
    _id: feedbackId,
    userId: new Types.ObjectId(authenticatedUser(request).id)
  });
  if (!deleted) throw new AppError(404, 'FEEDBACK_NOT_FOUND', 'Feedback unavailable.');
  sendSuccess(response, { removed: true }, 'Feedback removed');
});
router.get('/:category', validateParams(categoryParams), validateQuery(page), async (request, response) => {
  const { category } = request.validatedParams as z.infer<typeof categoryParams>;
  const { limit, cursor } = request.validatedQuery as z.infer<typeof page>;
  sendSuccess(
    response,
    await recommendationPage(authenticatedUser(request).id, category, limit, cursor),
    'Recommendations loaded'
  );
});
export default router;
