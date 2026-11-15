import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { AppError } from '../common/AppError.js';

export function validateBody(schema: z.ZodType): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      next(new AppError(400, 'VALIDATION_ERROR', 'Invalid request. Check the required fields.'));
      return;
    }
    request.body = result.data;
    next();
  };
}
