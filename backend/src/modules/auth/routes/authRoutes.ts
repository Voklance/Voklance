import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { sendFailure } from '../../../common/apiResponse.js';
import { requireAllowedOrigin } from '../../../middleware/requireAllowedOrigin.js';
import { requireDatabase } from '../../../middleware/requireDatabase.js';
import { validateBody } from '../../../middleware/validateBody.js';
import {
  login,
  logout,
  me,
  signup,
  verifyEmailAddress,
  resendVerificationEmail
} from '../controller/authController.js';
import { loginSchema, signupSchema } from '../validation/authSchemas.js';
import { verifyEmailSchema } from '../validation/emailVerificationSchemas.js';
import { requireAuth } from '../../../middleware/requireAuth.js';
import { requireEmailVerificationEnabled } from '../../../middleware/requireEmailVerificationEnabled.js';

const router = Router();
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response) =>
    sendFailure(response, 429, 'RATE_LIMITED', 'Too many attempts. Please try again later.')
});

router.use((_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store');
  next();
});
router.use(requireAllowedOrigin, requireDatabase);
router.post('/signup', authRateLimit, validateBody(signupSchema), signup);
router.post('/login', authRateLimit, validateBody(loginSchema), login);
router.get('/me', me);
router.post('/logout', logout);
router.post(
  '/verify-email',
  requireEmailVerificationEnabled,
  authRateLimit,
  validateBody(verifyEmailSchema),
  verifyEmailAddress
);
router.post('/resend-verification', requireEmailVerificationEnabled, requireAuth, resendVerificationEmail);

export default router;
