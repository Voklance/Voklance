import mongoose, { Schema, type Types } from 'mongoose';
export interface ConversationRecord {
  participantAId: Types.ObjectId;
  participantBId: Types.ObjectId;
  lastMessageId?: Types.ObjectId | null;
  lastMessageAt?: Date | null;
  activityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<ConversationRecord>(
  {
    participantAId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    participantBId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastMessageId: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
    lastMessageAt: { type: Date, default: null },
    activityAt: { type: Date, required: true, default: Date.now }
  },
  { timestamps: true }
);
schema.index({ participantAId: 1, participantBId: 1 }, { unique: true });
schema.index({ participantAId: 1, activityAt: -1, _id: -1 });
schema.index({ participantBId: 1, activityAt: -1, _id: -1 });
export default mongoose.model<ConversationRecord>('Conversation', schema);
