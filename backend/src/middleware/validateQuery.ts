import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { AppError } from '../common/AppError.js';

export function validateQuery(schema: z.ZodType): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.query);
    if (!result.success) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid query parameters.');
    request.validatedQuery = result.data;
    next();
  };
}
