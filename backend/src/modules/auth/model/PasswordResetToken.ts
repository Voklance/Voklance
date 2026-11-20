import mongoose, { Schema, type Types } from 'mongoose';
export interface PasswordResetTokenRecord {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}
const schema = new Schema<PasswordResetTokenRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
schema.index({ userId: 1, expiresAt: -1 });
export default mongoose.model<PasswordResetTokenRecord>('PasswordResetToken', schema);
