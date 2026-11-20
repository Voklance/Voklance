import mongoose, { Schema, type Types } from 'mongoose';
export interface GitHubConnectionRecord {
  userId: Types.ObjectId;
  githubUserId: string;
  githubUsername: string;
  githubProfileUrl: string;
  githubAvatarUrl?: string | null;
  connectedAt: Date;
  lastSyncedAt?: Date | null;
  syncStartedAt?: Date | null;
  syncStatus: 'never' | 'syncing' | 'success' | 'partial' | 'error';
  featuredRepositoryIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<GitHubConnectionRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    githubUserId: { type: String, required: true },
    githubUsername: { type: String, required: true },
    githubProfileUrl: { type: String, required: true },
    githubAvatarUrl: { type: String, default: null },
    connectedAt: { type: Date, required: true, default: Date.now },
    lastSyncedAt: { type: Date, default: null },
    syncStartedAt: { type: Date, default: null },
    syncStatus: { type: String, enum: ['never', 'syncing', 'success', 'partial', 'error'], default: 'never' },
    featuredRepositoryIds: [{ type: Schema.Types.ObjectId, ref: 'GitHubRepository' }]
  },
  { timestamps: true }
);
schema.index({ userId: 1 }, { unique: true });
schema.index({ githubUserId: 1 }, { unique: true });
schema.index({ githubUsername: 1 });
export default mongoose.model<GitHubConnectionRecord>('GitHubConnection', schema);
