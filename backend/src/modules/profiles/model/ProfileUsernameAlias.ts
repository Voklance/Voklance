import mongoose, { Schema, type Types } from 'mongoose';
import { USERNAME_PATTERN } from '@voklance/shared';
interface ProfileUsernameAliasRecord {
  username: string;
  userId: Types.ObjectId;
  createdAt: Date;
}
const schema = new Schema<ProfileUsernameAliasRecord>({
  username: { type: String, required: true, lowercase: true, trim: true, match: USERNAME_PATTERN },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});
schema.index({ username: 1 }, { unique: true });
schema.index({ userId: 1 });
export default mongoose.model<ProfileUsernameAliasRecord>('ProfileUsernameAlias', schema);
