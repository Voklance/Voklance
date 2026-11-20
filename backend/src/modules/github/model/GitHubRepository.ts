import mongoose, { Schema, type Types } from 'mongoose';
export interface GitHubRepositoryRecord {
  userId: Types.ObjectId;
  githubConnectionId: Types.ObjectId;
  githubRepositoryId: string;
  ownerLogin: string;
  name: string;
  fullName: string;
  description?: string | null;
  htmlUrl: string;
  primaryLanguage?: string | null;
  topics: string[];
  stargazersCount: number;
  forksCount: number;
  watchersCount: number;
  isFork: boolean;
  isArchived: boolean;
  isUnavailable: boolean;
  pushedAt?: Date | null;
  githubUpdatedAt: Date;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<GitHubRepositoryRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    githubConnectionId: { type: Schema.Types.ObjectId, ref: 'GitHubConnection', required: true },
    githubRepositoryId: { type: String, required: true },
    ownerLogin: { type: String, required: true },
    name: { type: String, required: true },
    fullName: { type: String, required: true },
    description: { type: String, default: null },
    htmlUrl: { type: String, required: true },
    primaryLanguage: { type: String, default: null },
    topics: { type: [String], default: [] },
    stargazersCount: { type: Number, min: 0, required: true },
    forksCount: { type: Number, min: 0, required: true },
    watchersCount: { type: Number, min: 0, required: true },
    isFork: { type: Boolean, required: true },
    isArchived: { type: Boolean, required: true },
    isUnavailable: { type: Boolean, default: false },
    pushedAt: { type: Date, default: null },
    githubUpdatedAt: { type: Date, required: true },
    lastSyncedAt: { type: Date, required: true }
  },
  { timestamps: true }
);
schema.index({ userId: 1, githubRepositoryId: 1 }, { unique: true });
schema.index({ userId: 1, isUnavailable: 1, githubUpdatedAt: -1, _id: -1 });
schema.index({ userId: 1, primaryLanguage: 1, stargazersCount: -1, _id: -1 });
schema.index({ userId: 1, name: 1, _id: -1 });
schema.index({ githubConnectionId: 1, isUnavailable: 1 });
schema.index({ name: 'text', description: 'text', topics: 'text', primaryLanguage: 'text' });
export default mongoose.model<GitHubRepositoryRecord>('GitHubRepository', schema);
