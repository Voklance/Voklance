import mongoose, { Schema } from 'mongoose';
import {
  ACCOUNT_STATUSES,
  ONBOARDING_STATUSES,
  type AccountStatus,
  type OnboardingStatus,
  type OnboardingStep
} from '@voklance/shared';

export interface UserRecord {
  name: string;
  email: string;
  passwordHash: string;
  emailVerifiedAt?: Date | null;
  emailVerificationRequired?: boolean;
  accountStatus?: AccountStatus;
  onboardingStatus?: OnboardingStatus;
  onboardingStep?: OnboardingStep;
  onboardingCompletedAt?: Date;
  sessionVersion?: number;
}

const userSchema = new Schema<UserRecord>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    emailVerifiedAt: { type: Date },
    // Only new registrations opt in. Missing is a legacy account, pending an approved rollout.
    emailVerificationRequired: { type: Boolean },
    accountStatus: { type: String, enum: [...ACCOUNT_STATUSES], default: 'ACTIVE' },
    onboardingStatus: { type: String, enum: [...ONBOARDING_STATUSES], default: 'NOT_STARTED' },
    onboardingStep: {
      type: Number,
      default: 1,
      min: 1,
      max: 6,
      validate: { validator: Number.isInteger, message: 'Onboarding step must be an integer.' }
    },
    onboardingCompletedAt: { type: Date },
    sessionVersion: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

export default mongoose.model<UserRecord>('User', userSchema);
