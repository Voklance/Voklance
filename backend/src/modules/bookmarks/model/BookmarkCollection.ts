import mongoose, { Schema, type Types } from 'mongoose';
export interface BookmarkCollectionRecord {
  userId: Types.ObjectId;
  name: string;
  nameKey: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<BookmarkCollectionRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, trim: true, required: true, minlength: 1, maxlength: 80 },
    nameKey: { type: String, required: true },
    description: { type: String, trim: true, maxlength: 240, default: '' }
  },
  { timestamps: true }
);
schema.index({ userId: 1, nameKey: 1 }, { unique: true });
schema.index({ userId: 1, createdAt: -1, _id: -1 });
export default mongoose.model<BookmarkCollectionRecord>('BookmarkCollection', schema);
