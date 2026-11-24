import mongoose, { Schema, type Types } from 'mongoose';

interface ProfileRatingRecord {
  profileUserId: Types.ObjectId;
  reviewerUserId: Types.ObjectId;
  stars: number;
}

const ratingSchema = new Schema<ProfileRatingRecord>(
  {
    profileUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reviewerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    stars: { type: Number, required: true, min: 1, max: 5 }
  },
  { timestamps: true }
);

ratingSchema.index({ profileUserId: 1, reviewerUserId: 1 }, { unique: true });

export default mongoose.model<ProfileRatingRecord>('ProfileRating', ratingSchema);
