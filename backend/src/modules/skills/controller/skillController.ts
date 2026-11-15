import type { RequestHandler } from 'express';
import { sendSuccess } from '../../../common/apiResponse.js';
import type { CatalogQuery } from '../../../common/validationSchemas.js';
import { authenticatedUser } from '../../../middleware/requireAuth.js';
import { getOwnSkills, listSkills, replaceOwnSkills } from '../service/skillService.js';
import type { SkillSelectionInput } from '../validation/skillSchemas.js';

export const getCatalog: RequestHandler = async (request, response) => {
  const data = await listSkills(request.validatedQuery as CatalogQuery);
  sendSuccess(response, data, 'Skills loaded');
};

export const getMine: RequestHandler = async (request, response) => {
  const skills = await getOwnSkills(authenticatedUser(request).id);
  sendSuccess(response, { skills }, 'Selected skills loaded');
};

export const putMine: RequestHandler = async (request, response) => {
  const { skillIds } = request.body as SkillSelectionInput;
  const skills = await replaceOwnSkills(authenticatedUser(request).id, skillIds);
  sendSuccess(response, { skills }, 'Selected skills saved');
};
