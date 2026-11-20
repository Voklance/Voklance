import mongoose, { Schema, type Types } from 'mongoose';
export interface ProfileCertificationRecord {
  userId: Types.ObjectId;
  name: string;
  issuingOrganization: string;
  issueDate: Date;
  expirationDate?: Date | null;
  credentialId?: string | null;
  credentialUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<ProfileCertificationRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    issuingOrganization: { type: String, required: true, trim: true, maxlength: 160 },
    issueDate: { type: Date, required: true },
    expirationDate: Date,
    credentialId: { type: String, trim: true, maxlength: 160 },
    credentialUrl: { type: String, trim: true, maxlength: 2048 }
  },
  { timestamps: true }
);
schema.index({ userId: 1, issueDate: -1, _id: -1 });
schema.index({ name: 'text', issuingOrganization: 'text' });
export default mongoose.model<ProfileCertificationRecord>('ProfileCertification', schema);
