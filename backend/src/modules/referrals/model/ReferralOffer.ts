import mongoose, { Schema, type Types } from 'mongoose';
import { offerStatuses, type OfferStatus } from '@voklance/shared';

export interface ReferralOfferRecord {
  needId: Types.ObjectId;
  offeredBy: Types.ObjectId;
  introduction: string;
  offerDetails: string;
  employerRelationship?: string | null;
  status: OfferStatus;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ReferralOfferRecord>(
  {
    needId: { type: Schema.Types.ObjectId, ref: 'CommunityActivity', required: true },
    offeredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    introduction: { type: String, trim: true, required: true, minlength: 20, maxlength: 1000 },
    offerDetails: { type: String, trim: true, required: true, minlength: 20, maxlength: 1000 },
    employerRelationship: { type: String, trim: true, maxlength: 250, default: null },
    status: { type: String, enum: [...offerStatuses], required: true, default: 'OFFERED' }
  },
  { timestamps: true }
);
schema.index({ needId: 1, offeredBy: 1 }, { unique: true });
schema.index({ needId: 1, createdAt: -1, _id: -1 });
schema.index({ offeredBy: 1, createdAt: -1, _id: -1 });
export default mongoose.model<ReferralOfferRecord>('ReferralOffer', schema);
