import { Router } from 'express';
import mongoose from 'mongoose';
import type { HealthData } from '@voklance/shared';
import { sendSuccess } from '../../../common/apiResponse.js';

const router = Router();

router.get('/', (_request, response) => {
  const data: HealthData = {
    status: 'ok',
    service: 'Voklance API',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  };
  sendSuccess(response, data, 'Service healthy');
});

export default router;
