import mongoose, { Schema, type Types } from 'mongoose';
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from '@voklance/shared';
export interface NotificationPreferenceRecord {
  userId: Types.ObjectId;
  category: NotificationCategory;
  inAppEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<NotificationPreferenceRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, enum: NOTIFICATION_CATEGORIES, required: true },
    inAppEnabled: { type: Boolean, required: true, default: true }
  },
  { timestamps: true }
);
schema.index({ userId: 1, category: 1 }, { unique: true });
export default mongoose.model<NotificationPreferenceRecord>('NotificationPreference', schema);
