import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import healthRouter from './routes/health.js';

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

app.get('/api', (_request, response) => {
  response.json({ message: 'Welcome to the Voklance API.' });
});
app.use('/api/health', healthRouter);

app.use((_request, response) => {
  response.status(404).json({ message: 'Route not found.' });
});

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error(error);
  const status = typeof error?.status === 'number' ? error.status : 500;
  response.status(status).json({
    message: status === 500 ? 'Something went wrong.' : error.message
  });
};

app.use(errorHandler);

export default app;
