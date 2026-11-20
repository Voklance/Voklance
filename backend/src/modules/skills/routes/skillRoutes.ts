import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { sendFailure } from '../../../common/apiResponse.js';
import { catalogQuerySchema } from '../../../common/validationSchemas.js';
import { requireAllowedOrigin } from '../../../middleware/requireAllowedOrigin.js';
import { authenticatedUser, requireAuth } from '../../../middleware/requireAuth.js';
import { requireVerifiedEmail } from '../../../middleware/requireVerifiedEmail.js';
import { requireDatabase } from '../../../middleware/requireDatabase.js';
import { validateBody } from '../../../middleware/validateBody.js';
import { validateQuery } from '../../../middleware/validateQuery.js';
import { getCatalog, getMine, postCatalog, putMine } from '../controller/skillController.js';
import { skillCreateSchema, skillSelectionSchema } from '../validation/skillSchemas.js';

const catalogRouter = Router();
const createLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  keyGenerator: (request) => authenticatedUser(request).id,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response) =>
    sendFailure(response, 429, 'RATE_LIMITED', 'Too many skills added. Try again later.')
});
catalogRouter.use(requireDatabase, requireAllowedOrigin, requireAuth, requireVerifiedEmail);
catalogRouter.get('/', validateQuery(catalogQuerySchema), getCatalog);
catalogRouter.post('/', createLimit, validateBody(skillCreateSchema), postCatalog);

const userRouter = Router();
userRouter.use(requireDatabase, requireAllowedOrigin, requireAuth, requireVerifiedEmail);
userRouter.get('/', getMine);
userRouter.put('/', validateBody(skillSelectionSchema), putMine);

export { catalogRouter as skillCatalogRoutes, userRouter as userSkillRoutes };
