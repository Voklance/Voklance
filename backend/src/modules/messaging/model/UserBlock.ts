import mongoose, { Schema, type Types } from 'mongoose';
export interface UserBlockRecord {
  blockerId: Types.ObjectId;
  blockedId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<UserBlockRecord>(
  {
    blockerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    blockedId: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);
schema.index({ blockerId: 1, blockedId: 1 }, { unique: true });
schema.index({ blockedId: 1, blockerId: 1 });
export default mongoose.model<UserBlockRecord>('UserBlock', schema);
