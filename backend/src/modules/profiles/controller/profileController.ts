import type { RequestHandler } from 'express';
import { sendSuccess } from '../../../common/apiResponse.js';
import { authenticatedUser } from '../../../middleware/requireAuth.js';
import {
  checkUsername,
  getOwnProfile,
  getPublicProfile,
  updateOwnProfile
} from '../service/profileService.js';
import type { ProfilePatchInput, UsernameQuery } from '../validation/profileSchemas.js';

export const getMe: RequestHandler = async (request, response) => {
  const profile = await getOwnProfile(authenticatedUser(request).id);
  sendSuccess(response, { profile }, 'Profile loaded');
};

export const patchMe: RequestHandler = async (request, response) => {
  const profile = await updateOwnProfile(authenticatedUser(request).id, request.body as ProfilePatchInput);
  sendSuccess(response, { profile }, 'Profile saved');
};

export const getUsernameAvailability: RequestHandler = async (request, response) => {
  const { username } = request.validatedQuery as UsernameQuery;
  const result = await checkUsername(authenticatedUser(request).id, username);
  sendSuccess(response, result, 'Username availability checked');
};

export const getPublic: RequestHandler = async (request, response) => {
  const username = (request.validatedParams as { username: string }).username;
  const data = await getPublicProfile(username);
  sendSuccess(response, data, 'Public profile loaded');
};
