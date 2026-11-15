import type { RequestHandler } from 'express';
import { sendSuccess } from '../../../common/apiResponse.js';
import type { IdParam } from '../../../common/validationSchemas.js';
import { authenticatedUser } from '../../../middleware/requireAuth.js';
import {
  createEducation,
  createExperience,
  deleteEducation,
  deleteExperience,
  getOwnEducations,
  getOwnExperiences,
  updateEducation,
  updateExperience
} from '../service/historyService.js';
import type {
  EducationInput,
  EducationPatchInput,
  ExperienceInput,
  ExperiencePatchInput
} from '../validation/historySchemas.js';

export const listExperiences: RequestHandler = async (request, response) => {
  const experiences = await getOwnExperiences(authenticatedUser(request).id);
  sendSuccess(response, { experiences }, 'Experiences loaded');
};
export const postExperience: RequestHandler = async (request, response) => {
  const experience = await createExperience(authenticatedUser(request).id, request.body as ExperienceInput);
  sendSuccess(response, { experience }, 'Experience created', 201);
};
export const patchExperience: RequestHandler = async (request, response) => {
  const { id } = request.validatedParams as IdParam;
  const experience = await updateExperience(
    authenticatedUser(request).id,
    id,
    request.body as ExperiencePatchInput
  );
  sendSuccess(response, { experience }, 'Experience updated');
};
export const removeExperience: RequestHandler = async (request, response) => {
  const { id } = request.validatedParams as IdParam;
  await deleteExperience(authenticatedUser(request).id, id);
  sendSuccess(response, {}, 'Experience deleted');
};

export const listEducations: RequestHandler = async (request, response) => {
  const educations = await getOwnEducations(authenticatedUser(request).id);
  sendSuccess(response, { educations }, 'Educations loaded');
};
export const postEducation: RequestHandler = async (request, response) => {
  const education = await createEducation(authenticatedUser(request).id, request.body as EducationInput);
  sendSuccess(response, { education }, 'Education created', 201);
};
export const patchEducation: RequestHandler = async (request, response) => {
  const { id } = request.validatedParams as IdParam;
  const education = await updateEducation(
    authenticatedUser(request).id,
    id,
    request.body as EducationPatchInput
  );
  sendSuccess(response, { education }, 'Education updated');
};
export const removeEducation: RequestHandler = async (request, response) => {
  const { id } = request.validatedParams as IdParam;
  await deleteEducation(authenticatedUser(request).id, id);
  sendSuccess(response, {}, 'Education deleted');
};
