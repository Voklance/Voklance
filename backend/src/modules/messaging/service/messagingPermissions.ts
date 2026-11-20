import { Types } from 'mongoose';
import { AppError } from '../../../common/AppError.js';
import { env } from '../../../config/env.js';
import Connection from '../../connections/model/Connection.js';
import Profile from '../../profiles/model/Profile.js';
import User from '../../users/model/User.js';
import Conversation from '../model/Conversation.js';
import UserBlock from '../model/UserBlock.js';

export const oid = (id: string) => new Types.ObjectId(id);
export const pair = (a: string, b: string) =>
  a < b
    ? { participantAId: oid(a), participantBId: oid(b) }
    : { participantAId: oid(b), participantBId: oid(a) };
export const hex = (id: Types.ObjectId) => id.toString();
export async function isBlocked(a: string, b: string) {
  return !!(await UserBlock.exists({
    $or: [
      { blockerId: oid(a), blockedId: oid(b) },
      { blockerId: oid(b), blockedId: oid(a) }
    ]
  }));
}
export async function assertPairEligible(a: string, b: string) {
  if (a === b) throw new AppError(404, 'CONVERSATION_UNAVAILABLE', 'Conversation unavailable.');
  const key = pair(a, b);
  const [users, profiles, connection, blocked] = await Promise.all([
    User.find({
      _id: { $in: [a, b] },
      onboardingStatus: 'COMPLETED',
      ...(env.emailVerificationEnabled ? { emailVerifiedAt: { $ne: null } } : {}),
      $or: [{ accountStatus: 'ACTIVE' }, { accountStatus: { $exists: false } }]
    })
      .select('_id')
      .lean(),
    Profile.find({ userId: { $in: [a, b] } })
      .select('allowDirectMessages')
      .lean(),
    Connection.findOne({ userLowId: key.participantAId, userHighId: key.participantBId, status: 'accepted' })
      .select('_id')
      .lean(),
    isBlocked(a, b)
  ]);
  if (
    users.length !== 2 ||
    profiles.length !== 2 ||
    profiles.some((profile) => profile.allowDirectMessages === false) ||
    !connection ||
    blocked
  )
    throw new AppError(404, 'CONVERSATION_UNAVAILABLE', 'Conversation unavailable.');
}
export async function assertConversation(userId: string, conversationId: string) {
  const conversation = await Conversation.findOne({
    _id: oid(conversationId),
    $or: [{ participantAId: oid(userId) }, { participantBId: oid(userId) }]
  }).lean();
  if (!conversation) throw new AppError(404, 'CONVERSATION_UNAVAILABLE', 'Conversation unavailable.');
  const otherId =
    hex(conversation.participantAId) === userId
      ? hex(conversation.participantBId)
      : hex(conversation.participantAId);
  await assertPairEligible(userId, otherId);
  return { conversation, otherId };
}
export async function canSeePresence(viewerId: string, targetId: string) {
  try {
    await assertPairEligible(viewerId, targetId);
  } catch {
    return false;
  }
  const profile = await Profile.findOne({ userId: oid(targetId) })
    .select('showOnlineStatus')
    .lean();
  return profile?.showOnlineStatus !== false;
}
