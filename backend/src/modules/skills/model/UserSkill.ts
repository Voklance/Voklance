import mongoose, { Schema, type Types } from 'mongoose';

export interface UserSkillRecord {
  userId: Types.ObjectId;
  skillId: Types.ObjectId;
}

const userSkillSchema = new Schema<UserSkillRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    skillId: { type: Schema.Types.ObjectId, ref: 'Skill', required: true }
  },
  { timestamps: true }
);

userSkillSchema.index({ userId: 1, skillId: 1 }, { unique: true });

export default mongoose.model<UserSkillRecord>('UserSkill', userSkillSchema, 'user_skills');
