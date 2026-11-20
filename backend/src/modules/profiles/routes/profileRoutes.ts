import { Router } from 'express';
import { requireAllowedOrigin } from '../../../middleware/requireAllowedOrigin.js';
import { requireAuth } from '../../../middleware/requireAuth.js';
import { requireVerifiedEmail } from '../../../middleware/requireVerifiedEmail.js';
import { requireDatabase } from '../../../middleware/requireDatabase.js';
import { validateBody } from '../../../middleware/validateBody.js';
import { validateQuery } from '../../../middleware/validateQuery.js';
import { validateParams } from '../../../middleware/validateParams.js';
import { requireCompletedOnboarding } from '../../../middleware/requireCompletedOnboarding.js';
import { authenticatedUser } from '../../../middleware/requireAuth.js';
import { sendSuccess } from '../../../common/apiResponse.js';
import { AppError } from '../../../common/AppError.js';
import Profile from '../model/Profile.js';
import { networkSettingsBody } from '../../connections/validation/connectionSchemas.js';
import { privacyBody } from '../../messaging/validation/messagingSchemas.js';
import { getPrivacy, updatePrivacy } from '../../messaging/service/conversationService.js';
import { getMe, getPublic, getUsernameAvailability, patchMe } from '../controller/profileController.js';
import {
  profilePatchSchema,
  publicUsernameParamsSchema,
  usernameQuerySchema
} from '../validation/profileSchemas.js';

const router = Router();
router.use(requireDatabase, requireAllowedOrigin);
router.get('/public/:username', validateParams(publicUsernameParamsSchema), getPublic);
router.get(
  '/check-username',
  requireAuth,
  requireVerifiedEmail,
  validateQuery(usernameQuerySchema),
  getUsernameAvailability
);
router.get('/me', requireAuth, requireVerifiedEmail, getMe);
const settingsDto = (profile: {
  profileDiscoverable?: boolean;
  allowConnectionRequests?: boolean;
  connectionListVisibility?: 'private' | 'connections';
}) => ({
  profileDiscoverable: profile.profileDiscoverable !== false,
  allowConnectionRequests: profile.allowConnectionRequests !== false,
  connectionListVisibility: profile.connectionListVisibility ?? 'private'
});
router.get(
  '/me/network-settings',
  requireAuth,
  requireVerifiedEmail,
  requireCompletedOnboarding,
  async (request, response) => {
    const profile = await Profile.findOne({ userId: authenticatedUser(request).id }).lean();
    if (!profile) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found.');
    sendSuccess(response, { settings: settingsDto(profile) }, 'Network settings loaded');
  }
);
router.patch(
  '/me/network-settings',
  requireAuth,
  requireVerifiedEmail,
  requireCompletedOnboarding,
  validateBody(networkSettingsBody),
  async (request, response) => {
    const profile = await Profile.findOneAndUpdate(
      { userId: authenticatedUser(request).id },
      { $set: request.body as Record<string, boolean | string> },
      { new: true, runValidators: true }
    );
    if (!profile) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found.');
    sendSuccess(response, { settings: settingsDto(profile) }, 'Network settings saved');
  }
);
router.get(
  '/me/messaging-settings',
  requireAuth,
  requireVerifiedEmail,
  requireCompletedOnboarding,
  async (request, response) =>
    sendSuccess(
      response,
      { settings: await getPrivacy(authenticatedUser(request).id) },
      'Messaging settings loaded'
    )
);
router.patch(
  '/me/messaging-settings',
  requireAuth,
  requireVerifiedEmail,
  requireCompletedOnboarding,
  validateBody(privacyBody),
  async (request, response) =>
    sendSuccess(
      response,
      {
        settings: await updatePrivacy(
          authenticatedUser(request).id,
          request.body as {
            allowDirectMessages?: boolean;
            showReadReceipts?: boolean;
            showOnlineStatus?: boolean;
          }
        )
      },
      'Messaging settings saved'
    )
);
router.patch('/me', requireAuth, requireVerifiedEmail, validateBody(profilePatchSchema), patchMe);
router.get('/:username', validateParams(publicUsernameParamsSchema), getPublic);

export default router;
