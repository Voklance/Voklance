import mongoose, { Schema, type Types } from 'mongoose';
interface PostLikeRecord {
  postId: Types.ObjectId;
  userId: Types.ObjectId;
  createdAt: Date;
}
const schema = new Schema<PostLikeRecord>({
  postId: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});
schema.index({ postId: 1, userId: 1 }, { unique: true });
export default mongoose.model<PostLikeRecord>('PostLike', schema);
