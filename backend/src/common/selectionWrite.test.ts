import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runSelectionWrite } from './selectionWrite.js';

let replica: MongoMemoryReplSet;

beforeAll(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replica.getUri());
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  if (replica) await replica.stop();
});

describe('selection writes on a replica set', () => {
  it('rolls back a failed multi-document write and commits a successful one', async () => {
    const collection = mongoose.connection.db!.collection('selection_write_test');
    await expect(
      runSelectionWrite(async (session) => {
        expect(session).toBeDefined();
        await collection.insertOne({ value: 'rolled-back' }, { session });
        throw new Error('abort');
      })
    ).rejects.toThrow('abort');
    expect(await collection.countDocuments()).toBe(0);

    await runSelectionWrite(async (session) => {
      await collection.insertOne({ value: 'committed' }, { session });
    });
    expect(await collection.countDocuments()).toBe(1);
  });
});
