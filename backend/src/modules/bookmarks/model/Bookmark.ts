import mongoose, { Schema, type Types } from 'mongoose';
import { BOOKMARK_TYPES, type BookmarkType } from '@voklance/shared';
export interface BookmarkRecord {
  userId: Types.ObjectId;
  entityType: BookmarkType;
  entityId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<BookmarkRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    entityType: { type: String, enum: [...BOOKMARK_TYPES], required: true },
    entityId: { type: Schema.Types.ObjectId, required: true }
  },
  { timestamps: true }
);
schema.index({ userId: 1, entityType: 1, entityId: 1 }, { unique: true });
schema.index({ userId: 1, createdAt: -1, _id: -1 });
schema.index({ userId: 1, entityType: 1, createdAt: -1, _id: -1 });
export default mongoose.model<BookmarkRecord>('Bookmark', schema);
