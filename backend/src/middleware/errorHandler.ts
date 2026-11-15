import type { ErrorRequestHandler } from 'express';
import { AppError } from '../common/AppError.js';
import { sendFailure } from '../common/apiResponse.js';

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (response.headersSent) return _next(error);
  if (error instanceof AppError) {
    sendFailure(response, error.status, error.code, error.message);
    return;
  }
  if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
    sendFailure(response, 400, 'INVALID_JSON', 'The request body must be valid JSON.');
    return;
  }
  console.error('Unhandled request error:', error);
  sendFailure(response, 500, 'INTERNAL_ERROR', 'Something went wrong.');
};
