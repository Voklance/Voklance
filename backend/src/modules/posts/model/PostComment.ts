import mongoose, { Schema, type Types } from 'mongoose';
import { COMMENT_CONTENT_LIMIT } from '@voklance/shared';
export interface PostCommentRecord {
  postId: Types.ObjectId;
  authorId: Types.ObjectId;
  content: string;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<PostCommentRecord>(
  {
    postId: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true, minlength: 1, maxlength: COMMENT_CONTENT_LIMIT },
    deletedAt: { type: Date }
  },
  { timestamps: true }
);
schema.index({ postId: 1, deletedAt: 1, createdAt: -1, _id: -1 });
schema.index({ authorId: 1 });
export default mongoose.model<PostCommentRecord>('PostComment', schema);
