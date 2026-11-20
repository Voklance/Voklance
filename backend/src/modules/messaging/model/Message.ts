import mongoose, { Schema, type Types } from 'mongoose';
import { MESSAGE_LIMIT } from '@voklance/shared';
export interface MessageRecord {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  body: string;
  clientMessageId: string;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<MessageRecord>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, minlength: 1, maxlength: MESSAGE_LIMIT },
    clientMessageId: { type: String, required: true, match: /^[0-9a-f-]{36}$/i }
  },
  { timestamps: true }
);
schema.index({ senderId: 1, clientMessageId: 1 }, { unique: true });
schema.index({ conversationId: 1, _id: -1 });
schema.index({ conversationId: 1, senderId: 1, _id: -1 });
export default mongoose.model<MessageRecord>('Message', schema);
