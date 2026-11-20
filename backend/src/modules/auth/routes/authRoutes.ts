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
  resendVerificationEmail,
  reactivateAccount
} from '../controller/authController.js';
import { loginSchema, signupSchema } from '../validation/authSchemas.js';
import { verifyEmailSchema } from '../validation/emailVerificationSchemas.js';
import { requireAuth } from '../../../middleware/requireAuth.js';
import { requireEmailVerificationEnabled } from '../../../middleware/requireEmailVerificationEnabled.js';
import { forgotPassword, resetPassword } from '../service/passwordResetService.js';
import { sendSuccess } from '../../../common/apiResponse.js';
import { z } from 'zod';

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
router.post('/reactivate', authRateLimit, validateBody(loginSchema), reactivateAccount);
router.post(
  '/forgot-password',
  authRateLimit,
  validateBody(
    z
      .object({
        email: z
          .email()
          .max(254)
          .transform((value) => value.toLowerCase())
      })
      .strict()
  ),
  async (request, response) =>
    sendSuccess(
      response,
      await forgotPassword((request.body as { email: string }).email.toLowerCase()),
      'If the account is eligible, a reset link has been sent.'
    )
);
router.post(
  '/reset-password',
  authRateLimit,
  validateBody(
    z
      .object({
        token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
        newPassword: z.string().min(12).max(128),
        confirmPassword: z.string()
      })
      .strict()
      .refine((value) => value.newPassword === value.confirmPassword, { path: ['confirmPassword'] })
  ),
  async (request, response) => {
    const { token, newPassword } = request.body as { token: string; newPassword: string };
    sendSuccess(response, await resetPassword(token, newPassword), 'Password reset. Sign in again.');
  }
);
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
