import type { RequestHandler } from 'express';

export const requestLogger: RequestHandler = (request, response, next) => {
  const started = Date.now();
  response.on('finish', () => {
    console.info(`${request.method} ${request.path} ${response.statusCode} ${Date.now() - started}ms`);
  });
  next();
};
