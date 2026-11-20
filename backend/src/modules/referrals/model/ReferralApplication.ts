import mongoose, { Schema, type Types } from 'mongoose';
import { applicationStatuses, type ApplicationStatus } from '@voklance/shared';

export interface ReferralApplicationRecord {
  opportunityId: Types.ObjectId;
  applicantId: Types.ObjectId;
  introduction: string;
  relevantSkills: string[];
  portfolioUrl?: string | null;
  status: ApplicationStatus;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ReferralApplicationRecord>(
  {
    opportunityId: { type: Schema.Types.ObjectId, ref: 'CommunityActivity', required: true },
    applicantId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    introduction: { type: String, trim: true, required: true, minlength: 20, maxlength: 1000 },
    relevantSkills: {
      type: [String],
      default: [],
      validate: [
        (value: string[]) =>
          value.length <= 12 && value.every((item) => item.length >= 2 && item.length <= 40),
        'Invalid skills.'
      ]
    },
    portfolioUrl: { type: String, trim: true, maxlength: 2048, default: null },
    status: { type: String, enum: [...applicationStatuses], required: true, default: 'REQUESTED' }
  },
  { timestamps: true }
);
schema.index({ opportunityId: 1, applicantId: 1 }, { unique: true });
schema.index({ opportunityId: 1, createdAt: -1, _id: -1 });
schema.index({ applicantId: 1, createdAt: -1, _id: -1 });
export default mongoose.model<ReferralApplicationRecord>('ReferralApplication', schema);
