import mongoose, { Schema, type Types } from 'mongoose';

interface PostFollowRecord {
  followerId: Types.ObjectId;
  followeeId: Types.ObjectId;
  createdAt: Date;
}

const schema = new Schema<PostFollowRecord>({
  followerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  followeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});
schema.index({ followerId: 1, followeeId: 1 }, { unique: true });
schema.index({ followeeId: 1, followerId: 1 });
export default mongoose.model<PostFollowRecord>('PostFollow', schema);
