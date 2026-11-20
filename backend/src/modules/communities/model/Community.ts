import mongoose, { Schema, type Types } from 'mongoose';
import {
  COMMUNITY_CATEGORIES,
  type CommunityCategory,
  type CommunityStatus,
  type CommunityVisibility
} from '@voklance/shared';

export interface CommunityRecord {
  name: string;
  slug: string;
  description: string;
  category: CommunityCategory;
  tags: string[];
  ownerId: Types.ObjectId;
  visibility: CommunityVisibility;
  status: CommunityStatus | 'CREATING';
  rules: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<CommunityRecord>(
  {
    name: { type: String, required: true, trim: true, minlength: 3, maxlength: 80 },
    slug: { type: String, required: true, lowercase: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 1000 },
    category: { type: String, required: true, enum: [...COMMUNITY_CATEGORIES] },
    tags: {
      type: [String],
      default: [],
      validate: [(items: string[]) => items.length <= 8, 'Too many tags.']
    },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    visibility: { type: String, enum: ['PUBLIC', 'PRIVATE'], default: 'PUBLIC', required: true },
    status: { type: String, enum: ['CREATING', 'ACTIVE', 'ARCHIVED'], default: 'CREATING', required: true },
    rules: { type: String, trim: true, maxlength: 3000, default: '' }
  },
  { timestamps: true }
);
schema.index({ slug: 1 }, { unique: true });
schema.index({ status: 1, createdAt: -1, _id: -1 });
schema.index({ status: 1, category: 1, createdAt: -1, _id: -1 });
schema.index({ ownerId: 1 });
schema.index({ name: 'text', description: 'text', tags: 'text' });
export default mongoose.model<CommunityRecord>('Community', schema);
