import mongoose, { Schema, type Types } from 'mongoose';
import type { ResourceReportReason, ResourceReportStatus } from '@voklance/shared';

export interface ResourceReportRecord {
  communityId: Types.ObjectId;
  resourceId: Types.ObjectId;
  reportedBy: Types.ObjectId;
  reason: ResourceReportReason;
  description?: string;
  status: ResourceReportStatus;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<ResourceReportRecord>(
  {
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', required: true },
    resourceId: { type: Schema.Types.ObjectId, ref: 'CommunityResource', required: true },
    reportedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: {
      type: String,
      enum: ['spam', 'misleading', 'copyright', 'inappropriate', 'malicious', 'other'],
      required: true
    },
    description: { type: String, trim: true, maxlength: 1000 },
    status: { type: String, enum: ['pending', 'reviewed', 'dismissed'], default: 'pending', required: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date
  },
  { timestamps: true }
);
schema.index({ resourceId: 1, reportedBy: 1 }, { unique: true });
schema.index({ communityId: 1, status: 1, createdAt: -1, _id: -1 });
export default mongoose.model<ResourceReportRecord>('ResourceReport', schema);
