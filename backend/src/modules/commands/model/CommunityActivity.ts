import mongoose, { Schema, type Types } from 'mongoose';
import { COMMAND_IDS, type CommandId, type CommandPayload } from '@voklance/shared';
import { findCommand } from '../registry/commandRegistry.js';

export interface CommunityActivityRecord {
  communityId: Types.ObjectId;
  authorId: Types.ObjectId;
  commandType: CommandId;
  payloadVersion: number;
  payload: CommandPayload | null;
  referralStatus?: 'OPEN' | 'CLOSED' | 'FULFILLED';
  status: 'ACTIVE' | 'DELETED';
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<CommunityActivityRecord>(
  {
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    commandType: { type: String, enum: [...COMMAND_IDS], required: true },
    payloadVersion: { type: Number, required: true, min: 1 },
    payload: {
      type: Schema.Types.Mixed,
      required: function (this: CommunityActivityRecord) {
        return this.status === 'ACTIVE';
      },
      validate: {
        validator: function (this: CommunityActivityRecord, value: unknown) {
          if (this.status === 'DELETED' && value == null) return true;
          const definition = findCommand(this.commandType);
          return (
            !!definition &&
            definition.payloadVersion === this.payloadVersion &&
            definition.schema.safeParse(value).success
          );
        },
        message: 'Invalid command payload.'
      }
    },
    referralStatus: {
      type: String,
      enum: ['OPEN', 'CLOSED', 'FULFILLED'],
      default: function (this: CommunityActivityRecord) {
        return this.commandType === 'referral' || this.commandType === 'needreferral' ? 'OPEN' : undefined;
      }
    },
    status: { type: String, enum: ['ACTIVE', 'DELETED'], default: 'ACTIVE', required: true },
    deletedAt: { type: Date, default: null }
  },
  { timestamps: true }
);
schema.index({ communityId: 1, status: 1, createdAt: -1, _id: -1 });
schema.index({ communityId: 1, status: 1, commandType: 1, createdAt: -1, _id: -1 });
schema.index({ authorId: 1, createdAt: -1, _id: -1 });
export default mongoose.model<CommunityActivityRecord>('CommunityActivity', schema);
