import mongoose, { Schema, type Types } from 'mongoose';
import { COMMUNITY_ROLES, type CommunityRole, type MembershipStatus } from '@voklance/shared';

export interface CommunityMembershipRecord {
  communityId: Types.ObjectId;
  userId: Types.ObjectId;
  role: CommunityRole;
  status: Exclude<MembershipStatus, null>;
  joinedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<CommunityMembershipRecord>(
  {
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: [...COMMUNITY_ROLES], default: 'MEMBER', required: true },
    status: { type: String, enum: ['PENDING', 'ACTIVE', 'REJECTED', 'REMOVED'], required: true },
    joinedAt: { type: Date, default: null }
  },
  { timestamps: true }
);
schema.index({ communityId: 1, userId: 1 }, { unique: true });
schema.index(
  { communityId: 1, role: 1 },
  { unique: true, partialFilterExpression: { role: 'OWNER', status: 'ACTIVE' } }
);
schema.index({ communityId: 1, status: 1, createdAt: -1, _id: -1 });
schema.index({ userId: 1, status: 1, createdAt: -1, _id: -1 });
export default mongoose.model<CommunityMembershipRecord>('CommunityMembership', schema);
