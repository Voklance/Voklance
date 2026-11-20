import mongoose from 'mongoose';
import { AppError } from './AppError.js';

export async function withReplicaTransaction<T>(
  work: (session: mongoose.ClientSession) => Promise<T>
): Promise<T> {
  const hello = await mongoose.connection.db?.admin().command({ hello: 1 });
  if (!hello?.setName && hello?.msg !== 'isdbgrid')
    throw new AppError(503, 'TRANSACTIONS_REQUIRED', 'This write requires a MongoDB replica set.');
  const session = await mongoose.startSession();
  let result: T | undefined;
  try {
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}
