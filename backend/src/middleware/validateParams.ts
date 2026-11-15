import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { AppError } from '../common/AppError.js';

export function validateParams(schema: z.ZodType): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.params);
    if (!result.success) throw new AppError(400, 'VALIDATION_ERROR', 'Invalid route parameters.');
    request.validatedParams = result.data;
    next();
  };
}
