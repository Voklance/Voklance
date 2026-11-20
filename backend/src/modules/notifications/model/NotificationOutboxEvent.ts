import mongoose, { Schema, type Types } from 'mongoose';
import {
  NOTIFICATION_ENTITY_TYPES,
  NOTIFICATION_TYPES,
  type NotificationEntityType,
  type NotificationType
} from '@voklance/shared';
export interface NotificationOutboxRecord {
  recipientId: Types.ObjectId;
  actorId?: Types.ObjectId | null;
  type: NotificationType;
  entityType: NotificationEntityType;
  entityId: Types.ObjectId;
  deduplicationKey: string;
  status: 'pending' | 'processing' | 'processed' | 'failed';
  attempts: number;
  nextAttemptAt: Date;
  leaseUntil?: Date | null;
  processedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<NotificationOutboxRecord>(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    entityType: { type: String, enum: NOTIFICATION_ENTITY_TYPES, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    deduplicationKey: { type: String, required: true, maxlength: 200 },
    status: {
      type: String,
      enum: ['pending', 'processing', 'processed', 'failed'],
      default: 'pending',
      required: true
    },
    attempts: { type: Number, min: 0, default: 0, required: true },
    nextAttemptAt: { type: Date, default: Date.now, required: true },
    leaseUntil: { type: Date, default: null },
    processedAt: { type: Date, default: null }
  },
  { timestamps: true }
);
schema.index({ recipientId: 1, deduplicationKey: 1 }, { unique: true });
schema.index({ status: 1, nextAttemptAt: 1, _id: 1 });
schema.index({ status: 1, leaseUntil: 1 });
export default mongoose.model<NotificationOutboxRecord>('NotificationOutboxEvent', schema);
