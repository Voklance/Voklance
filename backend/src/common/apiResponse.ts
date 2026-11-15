import type { ApiFailure, ApiSuccess } from '@voklance/shared';
import type { Response } from 'express';

export function sendSuccess<T>(response: Response, data: T, message: string, status = 200) {
  const body: ApiSuccess<T> = { success: true, data, message };
  response.status(status).json(body);
}

export function sendFailure(response: Response, status: number, code: string, message: string) {
  const body: ApiFailure = { success: false, error: { code, message } };
  response.status(status).json(body);
}
