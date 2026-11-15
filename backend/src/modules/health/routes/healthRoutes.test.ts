import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../../app.js';

describe('API foundation', () => {
  it('returns the versioned health response envelope', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: 'Service healthy',
      data: { status: 'ok', service: 'Voklance API' }
    });
    expect(response.body.data.timestamp).toEqual(expect.any(String));
  });

  it('returns the shared error envelope for unknown routes', async () => {
    const response = await request(app).get('/api/v1/missing');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route not found.' }
    });
  });
});
