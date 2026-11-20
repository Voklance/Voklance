import { Types } from 'mongoose';
import type { NotificationEntityType, NotificationType } from '@voklance/shared';
import NotificationOutboxEvent from '../model/NotificationOutboxEvent.js';
import { createNotification } from './notificationService.js';
export interface NotificationEventInput {
  recipientId: string;
  actorId?: string;
  type: NotificationType;
  entityType: NotificationEntityType;
  entityId: string;
  deduplicationKey: string;
}
const oid = (id: string) => new Types.ObjectId(id);
export async function queueNotification(input: NotificationEventInput) {
  if (input.recipientId === input.actorId) return;
  const filter = { recipientId: oid(input.recipientId), deduplicationKey: input.deduplicationKey };
  let record;
  try {
    record = await NotificationOutboxEvent.findOneAndUpdate(
      filter,
      {
        $setOnInsert: {
          ...input,
          recipientId: oid(input.recipientId),
          actorId: input.actorId ? oid(input.actorId) : null,
          entityId: oid(input.entityId),
          status: 'pending',
          attempts: 0,
          nextAttemptAt: new Date()
        }
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000)
      record = await NotificationOutboxEvent.findOne(filter);
    else throw error;
  }
  if (record && record.status !== 'processed' && record.status !== 'failed')
    await processNotificationEvent(record._id.toString());
}
export async function processNotificationEvent(id: string) {
  const now = new Date();
  const record = await NotificationOutboxEvent.findOneAndUpdate(
    {
      _id: oid(id),
      $or: [
        { status: 'pending', nextAttemptAt: { $lte: now } },
        { status: 'processing', leaseUntil: { $lte: now } }
      ]
    },
    { $set: { status: 'processing', leaseUntil: new Date(now.getTime() + 60_000) }, $inc: { attempts: 1 } },
    { new: true }
  );
  if (!record) return false;
  try {
    await createNotification({
      recipientId: record.recipientId.toString(),
      actorId: record.actorId?.toString(),
      type: record.type,
      entityType: record.entityType,
      entityId: record.entityId.toString(),
      deduplicationKey: record.deduplicationKey
    });
    await NotificationOutboxEvent.updateOne(
      { _id: record._id, status: 'processing' },
      { $set: { status: 'processed', processedAt: new Date(), leaseUntil: null } }
    );
    return true;
  } catch {
    const delay = Math.min(60_000 * 2 ** Math.min(record.attempts, 6), 3_600_000);
    await NotificationOutboxEvent.updateOne(
      { _id: record._id, status: 'processing' },
      {
        $set: {
          status: record.attempts >= 8 ? 'failed' : 'pending',
          nextAttemptAt: new Date(Date.now() + delay),
          leaseUntil: null
        }
      }
    );
    return false;
  }
}
export async function drainNotificationOutbox(limit = 20) {
  const now = new Date();
  const events = await NotificationOutboxEvent.find({
    $or: [
      { status: 'pending', nextAttemptAt: { $lte: now } },
      { status: 'processing', leaseUntil: { $lte: now } }
    ]
  })
    .sort({ nextAttemptAt: 1, _id: 1 })
    .limit(limit)
    .select('_id')
    .lean();
  for (const event of events) await processNotificationEvent(event._id.toString());
  return events.length;
}
