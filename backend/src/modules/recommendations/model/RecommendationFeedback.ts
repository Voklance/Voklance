import mongoose, { Schema, type Types } from 'mongoose';
import { RECOMMENDATION_CATEGORIES, RECOMMENDATION_FEEDBACK_ACTIONS } from '@voklance/shared';
export interface RecommendationFeedbackRecord {
  userId: Types.ObjectId;
  entityType: 'post' | (typeof RECOMMENDATION_CATEGORIES)[number];
  entityId: Types.ObjectId;
  action: (typeof RECOMMENDATION_FEEDBACK_ACTIONS)[number];
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<RecommendationFeedbackRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    entityType: { type: String, enum: ['post', ...RECOMMENDATION_CATEGORIES], required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    action: { type: String, enum: [...RECOMMENDATION_FEEDBACK_ACTIONS], required: true }
  },
  { timestamps: true }
);
schema.index({ userId: 1, entityType: 1, entityId: 1, action: 1 }, { unique: true });
schema.index({ userId: 1, entityType: 1, action: 1 });
export default mongoose.model<RecommendationFeedbackRecord>('RecommendationFeedback', schema);
