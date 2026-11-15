import type { RequestHandler } from 'express';
import { sendFailure } from '../common/apiResponse.js';

export const notFound: RequestHandler = (_request, response) => {
  sendFailure(response, 404, 'NOT_FOUND', 'Route not found.');
};
