import mongoose, { Schema, type Types } from 'mongoose';

export interface SessionRecord {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  sessionVersion?: number;
  createdAt: Date;
  lastSeenAt?: Date;
  userAgentSummary?: string;
}

const sessionSchema = new Schema<SessionRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    sessionVersion: { type: Number, default: 0 },
    lastSeenAt: { type: Date },
    userAgentSummary: { type: String, maxlength: 80 }
  },
  { timestamps: true }
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ userId: 1, expiresAt: -1 });

export default mongoose.model<SessionRecord>('Session', sessionSchema);
