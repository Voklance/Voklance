import mongoose, { Schema, type Types } from 'mongoose';

export interface UserInterestRecord {
  userId: Types.ObjectId;
  interestId: Types.ObjectId;
}

const userInterestSchema = new Schema<UserInterestRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    interestId: { type: Schema.Types.ObjectId, ref: 'Interest', required: true }
  },
  { timestamps: true }
);

userInterestSchema.index({ userId: 1, interestId: 1 }, { unique: true });

export default mongoose.model<UserInterestRecord>('UserInterest', userInterestSchema, 'user_interests');
