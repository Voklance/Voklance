import mongoose, { Schema, type Types } from 'mongoose';
export interface ParticipantStateRecord {
  conversationId: Types.ObjectId;
  userId: Types.ObjectId;
  lastReadMessageId?: Types.ObjectId | null;
  lastReadAt?: Date | null;
  muted: boolean;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<ParticipantStateRecord>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastReadMessageId: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
    lastReadAt: { type: Date, default: null },
    muted: { type: Boolean, default: false },
    archived: { type: Boolean, default: false }
  },
  { timestamps: true }
);
schema.index({ conversationId: 1, userId: 1 }, { unique: true });
schema.index({ userId: 1, archived: 1, conversationId: 1 });
export default mongoose.model<ParticipantStateRecord>('ConversationParticipantState', schema);
