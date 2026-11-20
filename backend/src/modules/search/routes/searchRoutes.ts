import { COMMUNITY_CATEGORIES, RESOURCE_CATEGORIES, SEARCH_CATEGORIES } from '@voklance/shared';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { sendFailure, sendSuccess } from '../../../common/apiResponse.js';
import { requireAllowedOrigin } from '../../../middleware/requireAllowedOrigin.js';
import { authenticatedUser, requireAuth } from '../../../middleware/requireAuth.js';
import { requireCompletedOnboarding } from '../../../middleware/requireCompletedOnboarding.js';
import { requireDatabase } from '../../../middleware/requireDatabase.js';
import { requireVerifiedEmail } from '../../../middleware/requireVerifiedEmail.js';
import { validateQuery } from '../../../middleware/validateQuery.js';
import { search, type SearchInput } from '../service/searchService.js';

const query = z
  .object({
    q: z
      .string()
      .trim()
      .min(2)
      .max(100)
      .transform((value) => value.replace(/\s+/g, ' ')),
    category: z.enum(SEARCH_CATEGORIES).default('all'),
    sort: z.enum(['relevance', 'recent']).default('relevance'),
    limit: z.coerce.number().int().min(1).max(30).default(15),
    cursor: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,20}$/)
      .optional(),
    location: z.string().trim().min(2).max(80).optional(),
    skill: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(80)
      .optional(),
    communityCategory: z.enum(COMMUNITY_CATEGORIES).optional(),
    eventType: z.enum(['event', 'meetup']).optional(),
    upcoming: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    resourceCategory: z.enum(RESOURCE_CATEGORIES).optional(),
    language: z.string().trim().min(1).max(60).optional(),
    featuredOnly: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional()
  })
  .strict();
const suggestionsQuery = z.object({ q: z.string().trim().min(2).max(60) }).strict();
const searchLimit = rateLimit({
  windowMs: 60_000,
  limit: 30,
  keyGenerator: (request) => authenticatedUser(request).id,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response) =>
    sendFailure(response, 429, 'RATE_LIMITED', 'Too many searches. Try again shortly.')
});
const router = Router();
router.use(
  requireDatabase,
  requireAllowedOrigin,
  requireAuth,
  requireVerifiedEmail,
  requireCompletedOnboarding,
  searchLimit
);
router.get('/suggestions', validateQuery(suggestionsQuery), async (request, response) => {
  const q = (request.validatedQuery as z.infer<typeof suggestionsQuery>).q;
  const [people, communities] = await Promise.all([
    search(authenticatedUser(request).id, { q, category: 'people', sort: 'relevance', limit: 3 }),
    search(authenticatedUser(request).id, { q, category: 'communities', sort: 'relevance', limit: 3 })
  ]);
  sendSuccess(response, { items: [...people.items, ...communities.items].slice(0, 6) }, 'Suggestions loaded');
});
router.get('/', validateQuery(query), async (request, response) =>
  sendSuccess(
    response,
    await search(authenticatedUser(request).id, request.validatedQuery as SearchInput),
    'Search results loaded'
  )
);
export default router;
