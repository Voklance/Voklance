import {
  PROFESSIONAL_STATUSES,
  PROFILE_VISIBILITIES,
  USERNAME_PATTERN,
  type ProfessionalStatus,
  type ProfileVisibility
} from '@voklance/shared';
import mongoose, { Schema, type Types } from 'mongoose';

export interface ProfileRecord {
  userId: Types.ObjectId;
  username: string;
  fullName: string;
  headline: string;
  bio?: string;
  avatarUrl?: string;
  city?: string;
  country: string;
  professionalStatus?: ProfessionalStatus;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
  websiteUrl?: string | null;
  visibility?: ProfileVisibility;
}

function safeProfessionalUrl(value: string | null | undefined) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

const profileSchema = new Schema<ProfileRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    username: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: USERNAME_PATTERN
    },
    fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    headline: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    bio: { type: String, trim: true, maxlength: 500 },
    avatarUrl: {
      type: String,
      trim: true,
      maxlength: 2048,
      validate: {
        validator: (value: string | undefined) => !value || /^https:\/\//.test(value),
        message: 'Avatar URL must use HTTPS.'
      }
    },
    city: { type: String, trim: true, maxlength: 100 },
    country: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    professionalStatus: { type: String, enum: [...PROFESSIONAL_STATUSES] },
    githubUrl: {
      type: String,
      trim: true,
      maxlength: 2048,
      validate: {
        validator: (value: string | null | undefined) =>
          !value ||
          (safeProfessionalUrl(value) &&
            ['github.com', 'www.github.com'].includes(new URL(value).hostname) &&
            new URL(value).pathname !== '/'),
        message: 'GitHub URL must point to a GitHub profile over HTTPS.'
      }
    },
    portfolioUrl: {
      type: String,
      trim: true,
      maxlength: 2048,
      validate: { validator: safeProfessionalUrl, message: 'Portfolio URL must use HTTPS.' }
    },
    websiteUrl: {
      type: String,
      trim: true,
      maxlength: 2048,
      validate: { validator: safeProfessionalUrl, message: 'Website URL must use HTTPS.' }
    },
    visibility: { type: String, enum: [...PROFILE_VISIBILITIES], default: 'PRIVATE' }
  },
  { timestamps: true }
);

profileSchema.index({ userId: 1 }, { unique: true });
profileSchema.index({ username: 1 }, { unique: true });

export default mongoose.model<ProfileRecord>('Profile', profileSchema);
