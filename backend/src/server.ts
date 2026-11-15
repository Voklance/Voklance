import app from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './database/connection.js';

await connectDatabase();

const server = app.listen(env.port, () => {
  console.info(`Voklance API listening on http://localhost:${env.port}`);
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`${signal} received; closing the API.`);
  const timeout = setTimeout(() => {
    console.error('Shutdown timed out.');
    process.exit(1);
  }, 10_000);
  timeout.unref();
  try {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
    await disconnectDatabase();
    clearTimeout(timeout);
    process.exit(0);
  } catch (error) {
    console.error('Shutdown failed:', error);
    process.exit(1);
  }
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
