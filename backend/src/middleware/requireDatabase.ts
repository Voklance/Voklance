import type { RequestHandler } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../common/AppError.js';

export const requireDatabase: RequestHandler = (_request, _response, next) => {
  if (mongoose.connection.readyState !== 1) {
    next(
      new AppError(
        503,
        'DATABASE_UNAVAILABLE',
        'Accounts are unavailable while the database is disconnected.'
      )
    );
    return;
  }
  next();
};
