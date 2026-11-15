import mongoose, { Schema } from 'mongoose';

export interface EmailVerificationThrottleRecord {
  key: string;
  windowStartedAt: Date;
  nextAllowedAt: Date;
  count: number;
  version: number;
  expiresAt: Date;
}

const schema = new Schema<EmailVerificationThrottleRecord>({
  key: { type: String, required: true, unique: true },
  windowStartedAt: { type: Date, required: true },
  nextAllowedAt: { type: Date, required: true },
  count: { type: Number, required: true, min: 0 },
  version: { type: Number, required: true, min: 0 },
  expiresAt: { type: Date, required: true }
});
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model<EmailVerificationThrottleRecord>('EmailVerificationThrottle', schema);
