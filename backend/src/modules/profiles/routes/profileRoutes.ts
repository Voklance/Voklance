import { Router } from 'express';
import type { Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireAllowedOrigin } from '../../../middleware/requireAllowedOrigin.js';
import { requireAuth } from '../../../middleware/requireAuth.js';
import { requireVerifiedEmail } from '../../../middleware/requireVerifiedEmail.js';
import { requireDatabase } from '../../../middleware/requireDatabase.js';
import { validateBody } from '../../../middleware/validateBody.js';
import { validateQuery } from '../../../middleware/validateQuery.js';
import { validateParams } from '../../../middleware/validateParams.js';
import { requireCompletedOnboarding } from '../../../middleware/requireCompletedOnboarding.js';
import { authenticatedUser } from '../../../middleware/requireAuth.js';
import { sendFailure, sendSuccess } from '../../../common/apiResponse.js';
import { AppError } from '../../../common/AppError.js';
import Profile from '../model/Profile.js';
import { networkSettingsBody } from '../../connections/validation/connectionSchemas.js';
import { privacyBody } from '../../messaging/validation/messagingSchemas.js';
import { getPrivacy, updatePrivacy } from '../../messaging/service/conversationService.js';
import { getMe, getPublic, getUsernameAvailability, patchMe } from '../controller/profileController.js';
import {
  profilePatchSchema,
  profileRatingBodySchema,
  publicUsernameParamsSchema,
  usernameQuerySchema
} from '../validation/profileSchemas.js';
import { publicRating, ratingSummary, savePublicRating } from '../service/profileRatingService.js';
import { deleteMedia, parseMediaForm, removeTempFile, saveMedia } from '../../media/mediaService.js';

const router = Router();
const photoUploadLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: (request) => authenticatedUser(request).id,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response) =>
    sendFailure(response, 429, 'RATE_LIMITED', 'Too many image uploads. Please try again later.')
});
type ProfileImageField = 'avatarUrl' | 'coverUrl';
async function uploadProfileImage(request: Request, response: Response, field: ProfileImageField) {
  const ownerId = authenticatedUser(request).id;
  if (!(await Profile.exists({ userId: ownerId })))
    throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found.');
  const { file } = await parseMediaForm(request);
  if (!file) throw new AppError(400, 'FILE_REQUIRED', 'Choose an image.');
  try {
    const media = await saveMedia(file, ownerId, field === 'coverUrl' ? 'cover' : 'image');
    try {
      const url = `/api/v1/media/${media.fileId}`;
      const previous = await Profile.findOneAndUpdate(
        { userId: ownerId },
        { $set: { [field]: url } },
        { runValidators: true }
      );
      if (!previous) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found.');
      if (previous[field]?.startsWith('/api/v1/media/'))
        await deleteMedia(previous[field]!.split('/').pop()!);
      sendSuccess(response, { [field]: url }, 'Profile image saved');
    } catch (error) {
      await deleteMedia(media.fileId);
      throw error;
    }
  } finally {
    await removeTempFile(file);
  }
}
async function removeProfileImage(request: Request, response: Response, field: ProfileImageField) {
  const ownerId = authenticatedUser(request).id;
  const previous = await Profile.findOneAndUpdate({ userId: ownerId }, { $unset: { [field]: 1 } });
  if (!previous) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found.');
  if (previous[field]?.startsWith('/api/v1/media/')) await deleteMedia(previous[field]!.split('/').pop()!);
  sendSuccess(response, { [field]: null }, 'Profile image removed');
}
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
router.post(
  '/me/avatar',
  requireAuth,
  requireVerifiedEmail,
  requireCompletedOnboarding,
  photoUploadLimit,
  async (request, response) => uploadProfileImage(request, response, 'avatarUrl')
);
router.delete(
  '/me/avatar',
  requireAuth,
  requireVerifiedEmail,
  requireCompletedOnboarding,
  async (request, response) => removeProfileImage(request, response, 'avatarUrl')
);
router.post(
  '/me/cover',
  requireAuth,
  requireVerifiedEmail,
  requireCompletedOnboarding,
  photoUploadLimit,
  async (request, response) => uploadProfileImage(request, response, 'coverUrl')
);
router.delete(
  '/me/cover',
  requireAuth,
  requireVerifiedEmail,
  requireCompletedOnboarding,
  async (request, response) => removeProfileImage(request, response, 'coverUrl')
);
router.get('/me/rating', requireAuth, requireVerifiedEmail, async (request, response) => {
  sendSuccess(response, await ratingSummary(authenticatedUser(request).id), 'Profile rating loaded');
});
router.get(
  '/public/:username/rating',
  requireAuth,
  requireVerifiedEmail,
  validateParams(publicUsernameParamsSchema),
  async (request, response) => {
    sendSuccess(
      response,
      await publicRating(
        (request.validatedParams as { username: string }).username,
        authenticatedUser(request).id
      ),
      'Profile rating loaded'
    );
  }
);
router.put(
  '/public/:username/rating',
  requireAuth,
  requireVerifiedEmail,
  requireCompletedOnboarding,
  validateParams(publicUsernameParamsSchema),
  validateBody(profileRatingBodySchema),
  async (request, response) => {
    sendSuccess(
      response,
      await savePublicRating(
        (request.validatedParams as { username: string }).username,
        authenticatedUser(request).id,
        (request.body as { stars: number }).stars
      ),
      'Profile rating saved'
    );
  }
);
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
