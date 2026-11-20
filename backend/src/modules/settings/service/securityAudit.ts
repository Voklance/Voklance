import { Types } from 'mongoose';
import SecurityAuditEvent, { SECURITY_EVENTS } from '../model/SecurityAuditEvent.js';
export function auditSecurityEvent(userId: string, action: (typeof SECURITY_EVENTS)[number]) {
  void SecurityAuditEvent.create({
    userId: new Types.ObjectId(userId),
    action,
    expiresAt: new Date(Date.now() + 365 * 86_400_000)
  }).catch(() => undefined);
}
