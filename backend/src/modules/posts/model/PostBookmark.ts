import mongoose, { Schema, type Types } from 'mongoose';
interface PostBookmarkRecord {
  postId: Types.ObjectId;
  userId: Types.ObjectId;
  createdAt: Date;
}
const schema = new Schema<PostBookmarkRecord>({
  postId: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});
schema.index({ userId: 1, postId: 1 }, { unique: true });
schema.index({ userId: 1, createdAt: -1, _id: -1 });
export default mongoose.model<PostBookmarkRecord>('PostBookmark', schema);
