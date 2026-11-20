import mongoose, { Schema, type Types } from 'mongoose';
import { RESOURCE_CATEGORIES, type ResourceCategory, type ResourceStatus } from '@voklance/shared';

export interface CommunityResourceRecord {
  communityId: Types.ObjectId;
  activityId: Types.ObjectId;
  createdBy: Types.ObjectId;
  title: string;
  description: string;
  category: ResourceCategory;
  tags: string[];
  fileId: Types.ObjectId;
  status: ResourceStatus;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<CommunityResourceRecord>(
  {
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', required: true },
    activityId: { type: Schema.Types.ObjectId, ref: 'CommunityActivity', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 160 },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
    category: { type: String, enum: [...RESOURCE_CATEGORIES], required: true },
    tags: { type: [String], default: [], validate: [(tags: string[]) => tags.length <= 8, 'Too many tags.'] },
    fileId: { type: Schema.Types.ObjectId, ref: 'StoredFile', required: true },
    status: { type: String, enum: ['published', 'hidden', 'deleted'], default: 'published', required: true },
    deletedAt: Date
  },
  { timestamps: true }
);
schema.index({ activityId: 1 }, { unique: true });
schema.index({ fileId: 1 }, { unique: true });
schema.index({ communityId: 1, status: 1, createdAt: -1, _id: -1 });
schema.index({ createdBy: 1, createdAt: -1, _id: -1 });
schema.index({ title: 'text', description: 'text' });
schema.index({ communityId: 1, status: 1, category: 1, createdAt: -1 });
schema.index({ communityId: 1, status: 1, tags: 1, createdAt: -1 });
export default mongoose.model<CommunityResourceRecord>('CommunityResource', schema);
