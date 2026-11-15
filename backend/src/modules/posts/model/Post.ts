import mongoose, { Schema, type Types } from 'mongoose';
import { POST_CONTENT_LIMIT } from '@voklance/shared';

export interface PostRecord {
  authorId: Types.ObjectId;
  content: string;
  status: 'PUBLISHED' | 'DELETED';
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<PostRecord>(
  {
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    content: { type: String, required: true, trim: true, minlength: 1, maxlength: POST_CONTENT_LIMIT },
    status: { type: String, enum: ['PUBLISHED', 'DELETED'], default: 'PUBLISHED', required: true }
  },
  { timestamps: true }
);
schema.index({ status: 1, createdAt: -1, _id: -1 });
export default mongoose.model<PostRecord>('Post', schema);
