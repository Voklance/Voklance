import mongoose, { Schema, type Types } from 'mongoose';

export interface EmailVerificationTokenRecord {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

const schema = new Schema<EmailVerificationTokenRecord>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, match: /^[a-f0-9]{64}$/ },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now, required: true }
});
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model<EmailVerificationTokenRecord>('EmailVerificationToken', schema);
