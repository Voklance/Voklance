import mongoose, { Schema, type Types } from 'mongoose';
import type { RSVPResponse } from '@voklance/shared';

export interface MeetupRSVPRecord {
  eventId: Types.ObjectId;
  userId: Types.ObjectId;
  response: RSVPResponse;
  respondedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<MeetupRSVPRecord>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'ProfessionalEvent', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    response: { type: String, enum: ['going', 'interested', 'not_going'], required: true },
    respondedAt: { type: Date, required: true }
  },
  { timestamps: true }
);
schema.index({ eventId: 1, userId: 1 }, { unique: true });
schema.index({ userId: 1, response: 1, eventId: 1 });
schema.index({ eventId: 1, response: 1, _id: 1 });
export default mongoose.model<MeetupRSVPRecord>('MeetupRSVP', schema);
