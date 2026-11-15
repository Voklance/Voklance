import mongoose, { Schema } from 'mongoose';

export interface InterestRecord {
  name: string;
  slug: string;
  category: string;
}

const interestSchema = new Schema<InterestRecord>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      maxlength: 80
    },
    category: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 }
  },
  { timestamps: true }
);

interestSchema.index({ slug: 1 }, { unique: true });

export default mongoose.model<InterestRecord>('Interest', interestSchema);
