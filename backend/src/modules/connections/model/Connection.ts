import { CONNECTION_STATUSES, type ConnectionStatus } from '@voklance/shared';
import mongoose, { Schema, type Types } from 'mongoose';

export interface ConnectionRecord {
  userLowId: Types.ObjectId;
  userHighId: Types.ObjectId;
  requesterId: Types.ObjectId;
  recipientId: Types.ObjectId;
  status: ConnectionStatus;
  requestedAt: Date;
  respondedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ConnectionRecord>(
  {
    userLowId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userHighId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    requesterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: [...CONNECTION_STATUSES], required: true },
    requestedAt: { type: Date, required: true },
    respondedAt: { type: Date, default: null }
  },
  { timestamps: true }
);
schema.index({ userLowId: 1, userHighId: 1 }, { unique: true });
schema.index({ recipientId: 1, status: 1, requestedAt: -1, _id: -1 });
schema.index({ requesterId: 1, status: 1, requestedAt: -1, _id: -1 });
schema.index({ userLowId: 1, status: 1, _id: -1 });
schema.index({ userHighId: 1, status: 1, _id: -1 });
export default mongoose.model<ConnectionRecord>('Connection', schema);
