import mongoose, { Schema, type Types } from 'mongoose';
export interface UserFeedPreferenceRecord {
  userId: Types.ObjectId;
  topics: string[];
  updatedAt: Date;
}
const schema = new Schema<UserFeedPreferenceRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    topics: {
      type: [String],
      default: [],
      validate: [
        (values: string[]) =>
          values.length <= 12 &&
          values.every((value) => /^[a-z0-9]+(?:[ -][a-z0-9]+)*$/.test(value) && value.length <= 40),
        'Invalid topic.'
      ]
    }
  },
  { timestamps: true }
);
schema.index({ userId: 1 }, { unique: true });
export default mongoose.model<UserFeedPreferenceRecord>('UserFeedPreference', schema);
