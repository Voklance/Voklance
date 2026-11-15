import mongoose, { Schema, type Types } from 'mongoose';

export interface ProfessionalExperienceRecord {
  userId: Types.ObjectId;
  jobTitle: string;
  companyName: string;
  employmentType?: string;
  startDate: Date;
  endDate?: Date;
  isCurrent: boolean;
  description?: string;
}

const experienceSchema = new Schema<ProfessionalExperienceRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    jobTitle: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    companyName: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    employmentType: { type: String, trim: true, maxlength: 60 },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    isCurrent: { type: Boolean, required: true, default: false },
    description: { type: String, trim: true, maxlength: 2000 }
  },
  { timestamps: true }
);

experienceSchema.path('endDate').validate(function (
  this: ProfessionalExperienceRecord,
  endDate: Date | undefined
) {
  if (this.isCurrent) return !endDate;
  return !endDate || endDate >= this.startDate;
}, 'End date must follow start date and be empty for a current role.');
experienceSchema.index({ userId: 1, startDate: -1 });

export default mongoose.model<ProfessionalExperienceRecord>(
  'ProfessionalExperience',
  experienceSchema,
  'professional_experiences'
);
