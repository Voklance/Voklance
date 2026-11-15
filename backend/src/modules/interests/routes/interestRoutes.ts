import { Router } from 'express';
import { catalogQuerySchema } from '../../../common/validationSchemas.js';
import { requireAllowedOrigin } from '../../../middleware/requireAllowedOrigin.js';
import { requireAuth } from '../../../middleware/requireAuth.js';
import { requireVerifiedEmail } from '../../../middleware/requireVerifiedEmail.js';
import { requireDatabase } from '../../../middleware/requireDatabase.js';
import { validateBody } from '../../../middleware/validateBody.js';
import { validateQuery } from '../../../middleware/validateQuery.js';
import { getCatalog, getMine, putMine } from '../controller/interestController.js';
import { interestSelectionSchema } from '../validation/interestSchemas.js';

const catalogRouter = Router();
catalogRouter.use(requireDatabase, requireAllowedOrigin, requireAuth, requireVerifiedEmail);
catalogRouter.get('/', validateQuery(catalogQuerySchema), getCatalog);

const userRouter = Router();
userRouter.use(requireDatabase, requireAllowedOrigin, requireAuth, requireVerifiedEmail);
userRouter.get('/', getMine);
userRouter.put('/', validateBody(interestSelectionSchema), putMine);

export { catalogRouter as interestCatalogRoutes, userRouter as userInterestRoutes };
