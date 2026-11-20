import mongoose, { Schema, type Types } from 'mongoose';
export interface GitHubOAuthStateRecord {
  userId: Types.ObjectId;
  sessionHash: string;
  stateHash: string;
  codeVerifier: string;
  expiresAt: Date;
  createdAt: Date;
}
const schema = new Schema<GitHubOAuthStateRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sessionHash: { type: String, required: true },
    stateHash: { type: String, required: true, unique: true },
    codeVerifier: { type: String, required: true },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
schema.index({ userId: 1, sessionHash: 1 });
export default mongoose.model<GitHubOAuthStateRecord>('GitHubOAuthState', schema);
