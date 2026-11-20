import mongoose, { Schema, type Types } from 'mongoose';
import type { EventLocationType, EventStatus, EventType } from '@voklance/shared';

export interface ProfessionalEventRecord {
  communityId: Types.ObjectId;
  activityId: Types.ObjectId;
  organizerId: Types.ObjectId;
  type: EventType;
  title: string;
  description: string;
  category?: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
  locationType: EventLocationType;
  venueName?: string;
  onlineUrl?: string;
  capacity?: number;
  confirmedCount: number;
  interestedCount: number;
  registrationOpen: boolean;
  status: EventStatus;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ProfessionalEventRecord>(
  {
    communityId: { type: Schema.Types.ObjectId, ref: 'Community', required: true },
    activityId: { type: Schema.Types.ObjectId, ref: 'CommunityActivity', required: true, unique: true },
    organizerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['event', 'meetup'], required: true },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 160 },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
    category: { type: String, trim: true, maxlength: 80 },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    timezone: { type: String, required: true },
    locationType: { type: String, enum: ['online', 'in_person', 'hybrid'], required: true },
    venueName: { type: String, trim: true, maxlength: 200 },
    onlineUrl: { type: String, maxlength: 2048 },
    capacity: { type: Number, min: 1, max: 10000 },
    confirmedCount: { type: Number, default: 0, min: 0 },
    interestedCount: { type: Number, default: 0, min: 0 },
    registrationOpen: { type: Boolean, default: true },
    status: { type: String, enum: ['scheduled', 'cancelled', 'completed'], default: 'scheduled' }
  },
  { timestamps: true }
);
schema.index({ communityId: 1, status: 1, startAt: 1, _id: 1 });
schema.index({ status: 1, startAt: 1, _id: 1 });
schema.index({ organizerId: 1, startAt: 1, _id: 1 });
schema.index({ title: 'text', description: 'text', category: 'text', venueName: 'text' });
export default mongoose.model<ProfessionalEventRecord>('ProfessionalEvent', schema);
