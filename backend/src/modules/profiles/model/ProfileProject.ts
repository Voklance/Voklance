import mongoose, { Schema, type Types } from 'mongoose';
export interface ProfileProjectRecord {
  userId: Types.ObjectId;
  title: string;
  description: string;
  role: string;
  technologies: string[];
  projectUrl?: string | null;
  repositoryUrl?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  isOngoing: boolean;
  isFeatured: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<ProfileProjectRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    role: { type: String, trim: true, maxlength: 120, default: '' },
    technologies: { type: [String], default: [] },
    projectUrl: { type: String, trim: true, maxlength: 2048 },
    repositoryUrl: { type: String, trim: true, maxlength: 2048 },
    startDate: Date,
    endDate: Date,
    isOngoing: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 0 }
  },
  { timestamps: true }
);
schema.index({ userId: 1, isFeatured: -1, displayOrder: 1, _id: -1 });
schema.index({ title: 'text', description: 'text', technologies: 'text' });
export default mongoose.model<ProfileProjectRecord>('ProfileProject', schema);
