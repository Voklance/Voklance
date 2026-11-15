import mongoose, { Schema, type Types } from 'mongoose';

interface SessionRecord {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
}

const sessionSchema = new Schema<SessionRecord>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true }
});

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<SessionRecord>('Session', sessionSchema);
