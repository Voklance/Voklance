import mongoose, { Schema, type Types } from 'mongoose';

export interface EducationRecord {
  userId: Types.ObjectId;
  institution: string;
  degree?: string;
  fieldOfStudy?: string;
  startDate: Date;
  endDate?: Date;
}

const educationSchema = new Schema<EducationRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    institution: { type: String, required: true, trim: true, minlength: 2, maxlength: 160 },
    degree: { type: String, trim: true, maxlength: 120 },
    fieldOfStudy: { type: String, trim: true, maxlength: 120 },
    startDate: { type: Date, required: true },
    endDate: { type: Date }
  },
  { timestamps: true }
);

educationSchema.path('endDate').validate(function (this: EducationRecord, endDate: Date | undefined) {
  return !endDate || endDate >= this.startDate;
}, 'End date must follow start date.');
educationSchema.index({ userId: 1, startDate: -1 });

export default mongoose.model<EducationRecord>('Education', educationSchema);
