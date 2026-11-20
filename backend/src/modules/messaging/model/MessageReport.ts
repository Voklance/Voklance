import { MESSAGE_REPORT_REASONS, type MessageReportReason } from '@voklance/shared';
import mongoose, { Schema, type Types } from 'mongoose';
export interface MessageReportRecord {
  messageId: Types.ObjectId;
  conversationId: Types.ObjectId;
  reporterId: Types.ObjectId;
  reason: MessageReportReason;
  status: 'pending' | 'reviewed';
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<MessageReportRecord>(
  {
    messageId: { type: Schema.Types.ObjectId, ref: 'Message', required: true },
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, enum: [...MESSAGE_REPORT_REASONS], required: true },
    status: { type: String, enum: ['pending', 'reviewed'], default: 'pending' }
  },
  { timestamps: true }
);
schema.index({ messageId: 1, reporterId: 1 }, { unique: true });
schema.index({ status: 1, createdAt: -1, _id: -1 });
export default mongoose.model<MessageReportRecord>('MessageReport', schema);
