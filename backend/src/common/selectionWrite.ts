import mongoose, { type ClientSession } from 'mongoose';

let checkedDatabase: mongoose.mongo.Db | undefined;
let supportsTransactions = false;

async function canUseTransactions() {
  const database = mongoose.connection.db;
  if (!database) return false;
  if (database !== checkedDatabase) {
    const hello = await database.admin().command({ hello: 1 });
    supportsTransactions = Boolean(hello.setName || hello.msg === 'isdbgrid');
    checkedDatabase = database;
    if (!supportsTransactions)
      console.warn('MongoDB is standalone; selection replacement uses retryable reconciliation.');
  }
  return supportsTransactions;
}

export async function runSelectionWrite(write: (session?: ClientSession) => Promise<void>) {
  if (!(await canUseTransactions())) {
    // Insert first, then remove obsolete links. A failed write keeps old selections;
    // repeating the same PUT converges to the requested set.
    await write();
    return;
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(() => write(session));
  } finally {
    await session.endSession();
  }
}
