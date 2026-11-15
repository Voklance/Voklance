import type { RequestHandler } from 'express';
import { sendSuccess } from '../../../common/apiResponse.js';
import type { CatalogQuery } from '../../../common/validationSchemas.js';
import { authenticatedUser } from '../../../middleware/requireAuth.js';
import { getOwnInterests, listInterests, replaceOwnInterests } from '../service/interestService.js';
import type { InterestSelectionInput } from '../validation/interestSchemas.js';

export const getCatalog: RequestHandler = async (request, response) => {
  const data = await listInterests(request.validatedQuery as CatalogQuery);
  sendSuccess(response, data, 'Interests loaded');
};

export const getMine: RequestHandler = async (request, response) => {
  const interests = await getOwnInterests(authenticatedUser(request).id);
  sendSuccess(response, { interests }, 'Selected interests loaded');
};

export const putMine: RequestHandler = async (request, response) => {
  const { interestIds } = request.body as InterestSelectionInput;
  const interests = await replaceOwnInterests(authenticatedUser(request).id, interestIds);
  sendSuccess(response, { interests }, 'Selected interests saved');
};
