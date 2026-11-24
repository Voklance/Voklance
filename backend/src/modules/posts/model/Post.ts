import mongoose, { Schema, type Types } from 'mongoose';
import { POST_CONTENT_LIMIT } from '@voklance/shared';

export interface PostRecord {
  authorId: Types.ObjectId;
  content: string;
  attachment?: {
    fileId: string;
    kind: 'image' | 'document';
    mimeType: string;
    filename: string;
    size: number;
  };
  status: 'PUBLISHED' | 'DELETED';
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<PostRecord>(
  {
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    content: { type: String, default: '', trim: true, maxlength: POST_CONTENT_LIMIT },
    attachment: {
      fileId: { type: String },
      kind: { type: String, enum: ['image', 'document'] },
      mimeType: { type: String },
      filename: { type: String },
      size: { type: Number }
    },
    status: { type: String, enum: ['PUBLISHED', 'DELETED'], default: 'PUBLISHED', required: true }
  },
  { timestamps: true }
);
schema.index({ status: 1, createdAt: -1, _id: -1 });
schema.index({ content: 'text' });
export default mongoose.model<PostRecord>('Post', schema);
