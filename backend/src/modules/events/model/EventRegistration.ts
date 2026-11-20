import mongoose, { Schema, type Types } from 'mongoose';
import type { RegistrationStatus } from '@voklance/shared';

export interface EventRegistrationRecord {
  eventId: Types.ObjectId;
  userId: Types.ObjectId;
  status: RegistrationStatus;
  registeredAt: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<EventRegistrationRecord>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'ProfessionalEvent', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['registered', 'cancelled'], required: true },
    registeredAt: { type: Date, required: true },
    cancelledAt: Date
  },
  { timestamps: true }
);
schema.index({ eventId: 1, userId: 1 }, { unique: true });
schema.index({ userId: 1, status: 1, eventId: 1 });
schema.index({ eventId: 1, status: 1, _id: 1 });
export default mongoose.model<EventRegistrationRecord>('EventRegistration', schema);
