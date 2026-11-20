import { Types } from 'mongoose';
import { AppError } from '../../../common/AppError.js';
import { hashToken } from '../../auth/service/authService.js';
import { hashPassword, verifyPassword } from '../../auth/service/passwordService.js';
import Session from '../../auth/model/Session.js';
import CommunityActivity from '../../commands/model/CommunityActivity.js';
import CommunityMembership from '../../memberships/model/CommunityMembership.js';
import UserBlock from '../../messaging/model/UserBlock.js';
import Message from '../../messaging/model/Message.js';
import Post from '../../posts/model/Post.js';
import PostComment from '../../posts/model/PostComment.js';
import Profile from '../../profiles/model/Profile.js';
import ProfessionalExperience from '../../profiles/model/ProfessionalExperience.js';
import Education from '../../profiles/model/Education.js';
import CommunityResource from '../../resources/model/CommunityResource.js';
import GitHubConnection from '../../github/model/GitHubConnection.js';
import UserInterest from '../../interests/model/UserInterest.js';
import UserSkill from '../../skills/model/UserSkill.js';
import UserFeedPreference from '../../recommendations/model/UserFeedPreference.js';
import User from '../../users/model/User.js';
import Bookmark from '../../bookmarks/model/Bookmark.js';
import BookmarkCollection from '../../bookmarks/model/BookmarkCollection.js';
import BookmarkCollectionItem from '../../bookmarks/model/BookmarkCollectionItem.js';
import { migrateLegacyPostBookmarks } from '../../bookmarks/service/legacyBookmarkMigration.js';
import ProfileProject from '../../profiles/model/ProfileProject.js';
import ProfileCertification from '../../profiles/model/ProfileCertification.js';
import ProfileUsernameAlias from '../../profiles/model/ProfileUsernameAlias.js';
import { disconnectSessionHash, disconnectUserSockets } from '../../../realtime/socketServer.js';
import { publishPrivacyChanged } from '../../../realtime/messagingHub.js';
import { createHash, randomBytes } from 'node:crypto';
import { env } from '../../../config/env.js';
import { sendEmailChangeEmail, sendEmailChangedEmail } from '../../../services/email/emailService.js';
import EmailChangeToken from '../model/EmailChangeToken.js';
import { auditSecurityEvent } from './securityAudit.js';

const oid = (value: string) => new Types.ObjectId(value);
async function account(userId: string) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Sign in first.');
  return user;
}
export async function verifyCurrentPassword(userId: string, password: string) {
  const user = await account(userId);
  if (!(await verifyPassword(password, user.passwordHash)))
    throw new AppError(403, 'PASSWORD_INCORRECT', 'Current password is incorrect.');
  return user;
}
export async function accountInfo(userId: string) {
  const [user, profile] = await Promise.all([
    account(userId),
    Profile.findOne({ userId: oid(userId) })
      .select('username visibility')
      .lean()
  ]);
  return {
    name: user.name,
    email: user.email,
    createdAt: user._id.getTimestamp().toISOString(),
    publicProfileUrl: profile?.visibility === 'PUBLIC' ? `/u/${profile.username}` : null,
    emailChangeAvailable: env.passwordRecoveryAvailable
  };
}
export async function updateAccountInfo(userId: string, name: string) {
  await User.updateOne({ _id: oid(userId) }, { $set: { name } }, { runValidators: true });
  return accountInfo(userId);
}
export async function requestEmailChange(userId: string, currentPassword: string, newEmail: string) {
  if (!env.passwordRecoveryAvailable)
    throw new AppError(503, 'EMAIL_CHANGE_UNAVAILABLE', 'Email delivery is not configured.');
  const user = await verifyCurrentPassword(userId, currentPassword);
  if (user.email === newEmail) throw new AppError(400, 'EMAIL_UNCHANGED', 'Enter a different email address.');
  if (await User.exists({ email: newEmail }))
    throw new AppError(409, 'EMAIL_EXISTS', 'This email is already in use.');
  const token = randomBytes(32).toString('base64url');
  await EmailChangeToken.deleteMany({ userId: user._id });
  const record = await EmailChangeToken.create({
    userId: user._id,
    newEmail,
    tokenHash: createHash('sha256').update(token).digest('hex'),
    expiresAt: new Date(Date.now() + 30 * 60_000)
  });
  const url = new URL('/confirm-email-change', env.appPublicUrl);
  url.hash = new URLSearchParams({ token }).toString();
  try {
    const sent = await sendEmailChangeEmail({ to: newEmail, url: url.toString() });
    if (!sent) throw new Error('Email delivery failed');
  } catch {
    await EmailChangeToken.deleteOne({ _id: record._id });
    throw new AppError(503, 'EMAIL_DELIVERY_UNAVAILABLE', 'Email could not be sent. Try again later.');
  }
  return { requested: true };
}
export async function confirmEmailChange(userId: string, token: string) {
  const record = await EmailChangeToken.findOneAndDelete({
    userId: oid(userId),
    tokenHash: createHash('sha256').update(token).digest('hex'),
    expiresAt: { $gt: new Date() }
  });
  if (!record)
    throw new AppError(400, 'EMAIL_CHANGE_LINK_INVALID', 'This email change link is invalid or expired.');
  const user = await account(userId);
  try {
    await User.updateOne(
      { _id: user._id },
      {
        $set: { email: record.newEmail, emailVerifiedAt: new Date(), emailVerificationRequired: true },
        $inc: { sessionVersion: 1 }
      }
    );
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000)
      throw new AppError(409, 'EMAIL_EXISTS', 'This email is already in use.');
    throw error;
  }
  await Promise.all([
    Session.deleteMany({ userId: user._id }),
    EmailChangeToken.deleteMany({ userId: user._id })
  ]);
  disconnectUserSockets(userId);
  auditSecurityEvent(userId, 'email_changed');
  void sendEmailChangedEmail(user.email).catch(() => undefined);
  return { signedOut: true };
}
export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await verifyCurrentPassword(userId, currentPassword);
  if (await verifyPassword(newPassword, user.passwordHash))
    throw new AppError(400, 'PASSWORD_REUSED', 'Choose a different password.');
  await User.updateOne(
    { _id: user._id },
    { $set: { passwordHash: await hashPassword(newPassword) }, $inc: { sessionVersion: 1 } }
  );
  await Session.deleteMany({ userId: user._id });
  disconnectUserSockets(userId);
  auditSecurityEvent(userId, 'password_changed');
  return { signedOut: true };
}
export async function activeSessions(userId: string, token: string | undefined) {
  const currentHash = token ? hashToken(token) : '';
  const user = await account(userId);
  const version = user.sessionVersion ?? 0;
  const rows = await Session.find({
    userId: oid(userId),
    expiresAt: { $gt: new Date() },
    ...(version === 0
      ? { $or: [{ sessionVersion: 0 }, { sessionVersion: { $exists: false } }] }
      : { sessionVersion: version })
  })
    .select('_id tokenHash createdAt lastSeenAt expiresAt userAgentSummary')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  return {
    items: rows.map((row) => ({
      id: row._id.toString(),
      current: row.tokenHash === currentHash,
      createdAt: (row.createdAt ?? row._id.getTimestamp()).toISOString(),
      lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
      expiresAt: row.expiresAt.toISOString(),
      device: row.userAgentSummary ?? 'Unknown device'
    }))
  };
}
export async function revokeOneSession(userId: string, token: string | undefined, sessionId: string) {
  const row = await Session.findOneAndDelete({ _id: oid(sessionId), userId: oid(userId) });
  if (!row) throw new AppError(404, 'SESSION_NOT_FOUND', 'Session unavailable.');
  disconnectSessionHash(row.tokenHash);
  auditSecurityEvent(userId, 'session_revoked');
  return { signedOut: !!token && row.tokenHash === hashToken(token) };
}
export async function revokeOtherSessions(userId: string, token: string | undefined, password: string) {
  await verifyCurrentPassword(userId, password);
  if (!token) throw new AppError(401, 'UNAUTHENTICATED', 'Sign in first.');
  await Session.deleteMany({ userId: oid(userId), tokenHash: { $ne: hashToken(token) } });
  disconnectUserSockets(userId, token);
  auditSecurityEvent(userId, 'sessions_revoked');
  return { revoked: true };
}
export async function revokeAllSessions(userId: string, password: string) {
  const user = await verifyCurrentPassword(userId, password);
  await User.updateOne({ _id: user._id }, { $inc: { sessionVersion: 1 } });
  await Session.deleteMany({ userId: user._id });
  disconnectUserSockets(userId);
  auditSecurityEvent(userId, 'sessions_revoked');
  return { signedOut: true };
}
export async function privacySettings(userId: string) {
  const profile = await Profile.findOne({ userId: oid(userId) }).lean();
  if (!profile) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile unavailable.');
  return {
    visibility: profile.visibility ?? 'PRIVATE',
    profileDiscoverable: profile.profileDiscoverable !== false,
    allowConnectionRequests: profile.allowConnectionRequests !== false,
    connectionListVisibility: profile.connectionListVisibility ?? 'private',
    allowDirectMessages: profile.allowDirectMessages !== false,
    showReadReceipts: profile.showReadReceipts === true,
    showOnlineStatus: profile.showOnlineStatus !== false
  };
}
export async function updatePrivacySettings(userId: string, input: Record<string, boolean | string>) {
  const profile = await Profile.findOneAndUpdate(
    { userId: oid(userId) },
    { $set: input },
    { new: true, runValidators: true }
  );
  if (!profile) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile unavailable.');
  await publishPrivacyChanged(userId);
  return privacySettings(userId);
}
export async function blockedUsers(userId: string) {
  const blocks = await UserBlock.find({ blockerId: oid(userId) })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  const profiles = await Profile.find({
    userId: { $in: blocks.map((row) => row.blockedId) },
    visibility: 'PUBLIC'
  })
    .select('userId username fullName')
    .lean();
  const byId = new Map(profiles.map((row) => [row.userId.toString(), row]));
  return {
    items: blocks.map((row) => ({
      userId: row.blockedId.toString(),
      name: byId.get(row.blockedId.toString())?.fullName ?? 'Blocked member',
      username: byId.get(row.blockedId.toString())?.username ?? null,
      blockedAt: row.createdAt.toISOString()
    }))
  };
}
export async function deactivateAccount(userId: string, password: string) {
  const user = await verifyCurrentPassword(userId, password);
  await User.updateOne(
    { _id: user._id, $or: [{ accountStatus: 'ACTIVE' }, { accountStatus: { $exists: false } }] },
    { $set: { accountStatus: 'DEACTIVATED' }, $inc: { sessionVersion: 1 } }
  );
  await Session.deleteMany({ userId: user._id });
  disconnectUserSockets(userId);
  auditSecurityEvent(userId, 'account_deactivated');
  return { signedOut: true };
}
export async function exportPersonalData(userId: string, password: string) {
  const user = await verifyCurrentPassword(userId, password);
  await migrateLegacyPostBookmarks(userId);
  const id = user._id;
  const queries = {
    profile: Profile.findOne({ userId: id })
      .select(
        'username fullName headline bio city country professionalStatus githubUrl portfolioUrl websiteUrl visibility profileDiscoverable allowConnectionRequests connectionListVisibility allowDirectMessages showReadReceipts showOnlineStatus sectionOrder'
      )
      .lean(),
    experiences: ProfessionalExperience.find({ userId: id })
      .select('jobTitle companyName employmentType startDate endDate isCurrent description')
      .limit(1001)
      .lean(),
    education: Education.find({ userId: id })
      .select('institution degree fieldOfStudy startDate endDate')
      .limit(1001)
      .lean(),
    certifications: ProfileCertification.find({ userId: id })
      .select('name issuingOrganization issueDate expirationDate credentialId credentialUrl')
      .limit(1001)
      .lean(),
    projects: ProfileProject.find({ userId: id })
      .select(
        'title description role technologies projectUrl repositoryUrl startDate endDate isOngoing isFeatured displayOrder'
      )
      .limit(1001)
      .lean(),
    profileAliases: ProfileUsernameAlias.find({ userId: id }).select('username createdAt').limit(1001).lean(),
    bookmarks: Bookmark.find({ userId: id }).select('entityType entityId createdAt').limit(1001).lean(),
    bookmarkCollections: BookmarkCollection.find({ userId: id })
      .select('name description createdAt')
      .limit(1001)
      .lean(),
    bookmarkCollectionItems: BookmarkCollectionItem.find({ userId: id })
      .select('collectionId bookmarkId createdAt')
      .limit(1001)
      .lean(),
    posts: Post.find({ authorId: id }).select('content status createdAt updatedAt').limit(1001).lean(),
    comments: PostComment.find({ authorId: id })
      .select('postId content createdAt updatedAt deletedAt')
      .limit(1001)
      .lean(),
    memberships: CommunityMembership.find({ userId: id })
      .select('communityId role status joinedAt')
      .limit(1001)
      .lean(),
    activities: CommunityActivity.find({ authorId: id })
      .select('communityId commandType payload status createdAt')
      .limit(1001)
      .lean(),
    resources: CommunityResource.find({ createdBy: id })
      .select('communityId title description category tags status createdAt')
      .limit(1001)
      .lean(),
    messages: Message.find({ senderId: id }).select('conversationId body createdAt').limit(1001).lean(),
    github: GitHubConnection.findOne({ userId: id })
      .select('githubUsername githubProfileUrl connectedAt lastSyncedAt')
      .lean(),
    interests: UserInterest.find({ userId: id }).select('interestId').limit(1001).lean(),
    skills: UserSkill.find({ userId: id }).select('skillId').limit(1001).lean(),
    feedPreferences: UserFeedPreference.findOne({ userId: id }).select('topics').lean()
  };
  const entries = await Promise.all(
    Object.entries(queries).map(async ([key, query]) => [key, await query] as const)
  );
  const record = Object.fromEntries(entries);
  for (const [key, value] of entries)
    if (Array.isArray(value) && value.length > 1000)
      throw new AppError(413, 'EXPORT_TOO_LARGE', `The ${key} export is too large for direct download.`);
  const result = {
    exportedAt: new Date().toISOString(),
    account: { name: user.name, email: user.email, createdAt: user._id.getTimestamp().toISOString() },
    ...record
  };
  const size = Buffer.byteLength(JSON.stringify(result));
  if (size > 5 * 1024 * 1024)
    throw new AppError(413, 'EXPORT_TOO_LARGE', 'The export is too large for direct download.');
  auditSecurityEvent(userId, 'data_exported');
  return result;
}
