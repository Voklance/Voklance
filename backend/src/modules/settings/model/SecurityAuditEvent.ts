import mongoose, { Schema, type Types } from 'mongoose';
export const SECURITY_EVENTS = [
  'password_changed',
  'password_reset',
  'email_changed',
  'session_revoked',
  'sessions_revoked',
  'account_deactivated',
  'account_reactivated',
  'data_exported'
] as const;
export interface SecurityAuditEventRecord {
  userId: Types.ObjectId;
  action: (typeof SECURITY_EVENTS)[number];
  createdAt: Date;
  expiresAt: Date;
}
const schema = new Schema<SecurityAuditEventRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, enum: [...SECURITY_EVENTS], required: true },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
schema.index({ userId: 1, createdAt: -1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model<SecurityAuditEventRecord>('SecurityAuditEvent', schema);
