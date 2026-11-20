import { createHash, randomBytes } from 'node:crypto';
import { AppError } from '../../../common/AppError.js';
import { env } from '../../../config/env.js';
import { sendPasswordChangedEmail, sendPasswordResetEmail } from '../../../services/email/emailService.js';
import Session from '../model/Session.js';
import PasswordResetToken from '../model/PasswordResetToken.js';
import User from '../../users/model/User.js';
import { hashPassword, verifyPassword } from './passwordService.js';
import { disconnectUserSockets } from '../../../realtime/socketServer.js';
import { auditSecurityEvent } from '../../settings/service/securityAudit.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export async function forgotPassword(email: string) {
  if (!env.passwordRecoveryAvailable)
    throw new AppError(503, 'PASSWORD_RECOVERY_UNAVAILABLE', 'Password recovery email is not configured.');
  const user = await User.findOne({
    email,
    $or: [{ accountStatus: 'ACTIVE' }, { accountStatus: { $exists: false } }]
  })
    .select('_id email')
    .lean();
  if (!user) return { requested: true };
  const token = randomBytes(32).toString('base64url');
  await PasswordResetToken.deleteMany({ userId: user._id });
  const record = await PasswordResetToken.create({
    userId: user._id,
    tokenHash: hash(token),
    expiresAt: new Date(Date.now() + 30 * 60_000)
  });
  const url = new URL('/reset-password', env.appPublicUrl);
  url.hash = new URLSearchParams({ token }).toString();
  try {
    const sent = await sendPasswordResetEmail({ to: user.email, resetUrl: url.toString() });
    if (!sent) await PasswordResetToken.deleteOne({ _id: record._id });
  } catch {
    await PasswordResetToken.deleteOne({ _id: record._id });
  }
  return { requested: true };
}
export async function resetPassword(token: string, newPassword: string) {
  const record = await PasswordResetToken.findOneAndDelete({
    tokenHash: hash(token),
    expiresAt: { $gt: new Date() }
  });
  if (!record) throw new AppError(400, 'RESET_LINK_INVALID', 'This reset link is invalid or expired.');
  const user = await User.findById(record.userId).select('+passwordHash');
  if (!user || (user.accountStatus && user.accountStatus !== 'ACTIVE'))
    throw new AppError(400, 'RESET_LINK_INVALID', 'This reset link is invalid or expired.');
  if (await verifyPassword(newPassword, user.passwordHash))
    throw new AppError(400, 'PASSWORD_REUSED', 'Choose a different password.');
  const passwordHash = await hashPassword(newPassword);
  await User.updateOne({ _id: user._id }, { $set: { passwordHash }, $inc: { sessionVersion: 1 } });
  await Promise.all([
    Session.deleteMany({ userId: user._id }),
    PasswordResetToken.deleteMany({ userId: user._id })
  ]);
  disconnectUserSockets(user._id.toString());
  auditSecurityEvent(user._id.toString(), 'password_reset');
  void sendPasswordChangedEmail(user.email).catch(() => undefined);
  return { reset: true };
}
