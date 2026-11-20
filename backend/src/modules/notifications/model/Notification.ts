import mongoose, { Schema, type Types } from 'mongoose';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_ENTITY_TYPES,
  NOTIFICATION_TYPES,
  type NotificationCategory,
  type NotificationEntityType,
  type NotificationType
} from '@voklance/shared';
export interface NotificationRecord {
  recipientId: Types.ObjectId;
  actorId?: Types.ObjectId | null;
  type: NotificationType;
  category: NotificationCategory;
  entityType: NotificationEntityType;
  entityId: Types.ObjectId;
  title: string;
  body: string;
  deduplicationKey: string;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<NotificationRecord>(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    category: { type: String, enum: NOTIFICATION_CATEGORIES, required: true },
    entityType: { type: String, enum: NOTIFICATION_ENTITY_TYPES, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, required: true, maxlength: 300 },
    deduplicationKey: { type: String, required: true, maxlength: 200 },
    readAt: { type: Date, default: null }
  },
  { timestamps: true }
);
schema.index({ recipientId: 1, deduplicationKey: 1 }, { unique: true });
schema.index({ recipientId: 1, createdAt: -1, _id: -1 });
schema.index({ recipientId: 1, category: 1, createdAt: -1, _id: -1 });
schema.index({ recipientId: 1, readAt: 1, createdAt: -1 });
export default mongoose.model<NotificationRecord>('Notification', schema);
