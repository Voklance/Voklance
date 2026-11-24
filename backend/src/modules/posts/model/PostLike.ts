import mongoose, { Schema, type Types } from 'mongoose';
interface PostLikeRecord {
  postId: Types.ObjectId;
  userId: Types.ObjectId;
  reaction?: 'like' | 'love' | 'celebrate' | 'insightful';
  createdAt: Date;
}
const schema = new Schema<PostLikeRecord>({
  postId: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reaction: { type: String, enum: ['like', 'love', 'celebrate', 'insightful'], default: 'like' },
  createdAt: { type: Date, default: Date.now }
});
schema.index({ postId: 1, userId: 1 }, { unique: true });
export default mongoose.model<PostLikeRecord>('PostLike', schema);
