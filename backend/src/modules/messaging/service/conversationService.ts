import type {
  ConversationDto,
  ConversationPage,
  ConversationPreferences,
  MessagePerson,
  MessagingPrivacySettings
} from '@voklance/shared';
import { Types, type PipelineStage } from 'mongoose';
import { AppError } from '../../../common/AppError.js';
import { env } from '../../../config/env.js';
import Profile from '../../profiles/model/Profile.js';
import User from '../../users/model/User.js';
import { publishAccessChanged, publishPrivacyChanged } from '../../../realtime/messagingHub.js';
import Conversation, { type ConversationRecord } from '../model/Conversation.js';
import ConversationParticipantState from '../model/ConversationParticipantState.js';
import Message from '../model/Message.js';
import UserBlock from '../model/UserBlock.js';
import { toMessage } from './messageService.js';
import { assertConversation, assertPairEligible, hex, oid, pair } from './messagingPermissions.js';

type StoredConversation = ConversationRecord & { _id: Types.ObjectId };
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export async function resolveConversationRecipient(input: {
  recipientId?: string;
  recipientUsername?: string;
}) {
  if (input.recipientId) return input.recipientId;
  const profile = await Profile.findOne({ username: input.recipientUsername }).select('userId').lean();
  if (!profile) throw new AppError(404, 'CONVERSATION_UNAVAILABLE', 'Conversation unavailable.');
  return hex(profile.userId);
}
export async function createConversation(userId: string, recipientId: string) {
  await assertPairEligible(userId, recipientId);
  const key = pair(userId, recipientId);
  let record: StoredConversation | null;
  try {
    record = await Conversation.findOneAndUpdate(
      key,
      { $setOnInsert: { ...key, activityAt: new Date() } },
      { upsert: true, new: true }
    );
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000)
      record = await Conversation.findOne(key);
    else throw error;
  }
  if (!record) throw new AppError(503, 'CONVERSATION_UNAVAILABLE', 'Conversation unavailable.');
  await Promise.all(
    [userId, recipientId].map((id) =>
      ConversationParticipantState.updateOne(
        { conversationId: record._id, userId: oid(id) },
        { $setOnInsert: { muted: false, archived: false } },
        { upsert: true }
      )
    )
  );
  return getConversation(userId, hex(record._id));
}

export async function unreadCounts(userId: string, conversationIds?: string[]) {
  const eligible: PipelineStage[] = conversationIds
    ? []
    : [
        {
          $lookup: {
            from: 'conversations',
            localField: 'conversationId',
            foreignField: '_id',
            as: 'conversation'
          }
        },
        { $unwind: '$conversation' },
        {
          $addFields: {
            otherId: {
              $cond: [
                { $eq: ['$conversation.participantAId', oid(userId)] },
                '$conversation.participantBId',
                '$conversation.participantAId'
              ]
            }
          }
        },
        {
          $lookup: {
            from: 'connections',
            let: { a: '$conversation.participantAId', b: '$conversation.participantBId' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$userLowId', '$$a'] },
                      { $eq: ['$userHighId', '$$b'] },
                      { $eq: ['$status', 'accepted'] }
                    ]
                  }
                }
              }
            ],
            as: 'connection'
          }
        },
        { $match: { 'connection.0': { $exists: true } } },
        {
          $lookup: {
            from: 'userblocks',
            let: { a: '$conversation.participantAId', b: '$conversation.participantBId' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [
                      { $and: [{ $eq: ['$blockerId', '$$a'] }, { $eq: ['$blockedId', '$$b'] }] },
                      { $and: [{ $eq: ['$blockerId', '$$b'] }, { $eq: ['$blockedId', '$$a'] }] }
                    ]
                  }
                }
              }
            ],
            as: 'blocks'
          }
        },
        { $match: { 'blocks.0': { $exists: false } } },
        {
          $lookup: {
            from: 'profiles',
            localField: 'conversation.participantAId',
            foreignField: 'userId',
            as: 'profileA'
          }
        },
        {
          $lookup: {
            from: 'profiles',
            localField: 'conversation.participantBId',
            foreignField: 'userId',
            as: 'profileB'
          }
        },
        {
          $match: {
            'profileA.0': { $exists: true },
            'profileB.0': { $exists: true },
            'profileA.allowDirectMessages': { $ne: false },
            'profileB.allowDirectMessages': { $ne: false }
          }
        },
        { $lookup: { from: 'users', localField: 'otherId', foreignField: '_id', as: 'otherUser' } },
        {
          $match: {
            otherUser: {
              $elemMatch: {
                onboardingStatus: 'COMPLETED',
                $or: [{ accountStatus: 'ACTIVE' }, { accountStatus: { $exists: false } }],
                ...(env.emailVerificationEnabled ? { emailVerifiedAt: { $ne: null } } : {})
              }
            }
          }
        }
      ];
  const rows = await ConversationParticipantState.aggregate<{
    conversationId: Types.ObjectId;
    count: number;
  }>([
    {
      $match: {
        userId: oid(userId),
        ...(conversationIds ? { conversationId: { $in: conversationIds.map(oid) } } : {})
      }
    },
    ...eligible,
    {
      $lookup: {
        from: 'messages',
        let: { cid: '$conversationId', last: '$lastReadMessageId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$conversationId', '$$cid'] },
                  { $ne: ['$senderId', oid(userId)] },
                  { $gt: ['$_id', { $ifNull: ['$$last', oid('000000000000000000000000')] }] }
                ]
              }
            }
          },
          { $count: 'count' }
        ],
        as: 'unread'
      }
    },
    { $project: { conversationId: 1, count: { $ifNull: [{ $arrayElemAt: ['$unread.count', 0] }, 0] } } }
  ]);
  const byConversation = new Map(rows.map((row) => [hex(row.conversationId), row.count]));
  return { count: rows.reduce((sum, row) => sum + row.count, 0), byConversation };
}

async function hydrate(userId: string, records: StoredConversation[]): Promise<ConversationDto[]> {
  if (!records.length) return [];
  const ids = records.map((record) => hex(record._id));
  const otherIds = records.map((record) =>
    hex(record.participantAId) === userId ? hex(record.participantBId) : hex(record.participantAId)
  );
  const [users, profiles, states, messages, unread] = await Promise.all([
    User.find({ _id: { $in: otherIds } })
      .select('name')
      .lean(),
    Profile.find({ userId: { $in: otherIds } })
      .select('userId username headline visibility showReadReceipts')
      .lean(),
    ConversationParticipantState.find({
      conversationId: { $in: ids },
      userId: { $in: [userId, ...otherIds] }
    }).lean(),
    Message.find({
      _id: { $in: records.flatMap((record) => (record.lastMessageId ? [record.lastMessageId] : [])) }
    }).lean(),
    unreadCounts(userId, ids)
  ]);
  const userMap = new Map(users.map((item) => [hex(item._id), item]));
  const profileMap = new Map(profiles.map((item) => [hex(item.userId), item]));
  const stateMap = new Map(states.map((item) => [`${hex(item.conversationId)}:${hex(item.userId)}`, item]));
  const messageMap = new Map(messages.map((item) => [hex(item._id), item]));
  return records.flatMap((record) => {
    const id = hex(record._id);
    const otherId =
      hex(record.participantAId) === userId ? hex(record.participantBId) : hex(record.participantAId);
    const user = userMap.get(otherId);
    if (!user) return [];
    const profile = profileMap.get(otherId);
    const ownState = stateMap.get(`${id}:${userId}`);
    const otherState = stateMap.get(`${id}:${otherId}`);
    const last = record.lastMessageId ? messageMap.get(hex(record.lastMessageId)) : undefined;
    const person: MessagePerson = {
      userId: otherId,
      name: user.name,
      username: profile?.visibility === 'PUBLIC' ? profile.username : null,
      headline: profile?.visibility === 'PUBLIC' ? profile.headline : null
    };
    return [
      {
        id,
        person,
        lastMessage: last ? toMessage(last) : null,
        lastMessageAt: record.lastMessageAt?.toISOString() ?? null,
        unreadCount: unread.byConversation.get(id) ?? 0,
        preferences: { muted: ownState?.muted ?? false, archived: ownState?.archived ?? false },
        otherLastReadMessageId:
          profile?.showReadReceipts === true && otherState?.lastReadMessageId
            ? hex(otherState.lastReadMessageId)
            : null,
        createdAt: record.createdAt.toISOString()
      }
    ];
  });
}
export async function getConversation(userId: string, conversationId: string) {
  const { conversation } = await assertConversation(userId, conversationId);
  const [dto] = await hydrate(userId, [conversation]);
  if (!dto) throw new AppError(404, 'CONVERSATION_UNAVAILABLE', 'Conversation unavailable.');
  return dto;
}
export async function listConversations(
  userId: string,
  query: { limit: number; cursor?: string; search?: string; includeArchived?: boolean }
): Promise<ConversationPage> {
  let cursor: { at: Date; id: Types.ObjectId } | null = null;
  if (query.cursor) {
    try {
      const value: unknown = JSON.parse(Buffer.from(query.cursor, 'base64url').toString());
      if (
        !value ||
        typeof value !== 'object' ||
        !('at' in value) ||
        !('id' in value) ||
        typeof value.at !== 'string' ||
        typeof value.id !== 'string' ||
        !Types.ObjectId.isValid(value.id)
      )
        throw new Error();
      const at = new Date(value.at);
      if (Number.isNaN(at.getTime())) throw new Error();
      cursor = { at, id: oid(value.id) };
    } catch {
      throw new AppError(400, 'INVALID_CURSOR', 'Invalid page cursor.');
    }
  }
  const search = query.search?.trim();
  const records = await Conversation.aggregate<StoredConversation>([
    {
      $match: {
        $or: [{ participantAId: oid(userId) }, { participantBId: oid(userId) }],
        ...(cursor
          ? {
              $and: [
                {
                  $or: [
                    { activityAt: { $lt: cursor.at } },
                    { activityAt: cursor.at, _id: { $lt: cursor.id } }
                  ]
                }
              ]
            }
          : {})
      }
    },
    {
      $addFields: {
        otherId: { $cond: [{ $eq: ['$participantAId', oid(userId)] }, '$participantBId', '$participantAId'] }
      }
    },
    {
      $lookup: {
        from: 'connections',
        let: { a: '$participantAId', b: '$participantBId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$userLowId', '$$a'] },
                  { $eq: ['$userHighId', '$$b'] },
                  { $eq: ['$status', 'accepted'] }
                ]
              }
            }
          }
        ],
        as: 'connection'
      }
    },
    { $match: { 'connection.0': { $exists: true } } },
    {
      $lookup: {
        from: 'userblocks',
        let: { a: '$participantAId', b: '$participantBId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $and: [{ $eq: ['$blockerId', '$$a'] }, { $eq: ['$blockedId', '$$b'] }] },
                  { $and: [{ $eq: ['$blockerId', '$$b'] }, { $eq: ['$blockedId', '$$a'] }] }
                ]
              }
            }
          }
        ],
        as: 'blocks'
      }
    },
    { $match: { 'blocks.0': { $exists: false } } },
    { $lookup: { from: 'profiles', localField: 'participantAId', foreignField: 'userId', as: 'profileA' } },
    { $lookup: { from: 'profiles', localField: 'participantBId', foreignField: 'userId', as: 'profileB' } },
    {
      $match: {
        'profileA.0': { $exists: true },
        'profileB.0': { $exists: true },
        'profileA.allowDirectMessages': { $ne: false },
        'profileB.allowDirectMessages': { $ne: false }
      }
    },
    { $lookup: { from: 'users', localField: 'otherId', foreignField: '_id', as: 'otherUser' } },
    {
      $match: {
        otherUser: {
          $elemMatch: {
            onboardingStatus: 'COMPLETED',
            $or: [{ accountStatus: 'ACTIVE' }, { accountStatus: { $exists: false } }],
            ...(env.emailVerificationEnabled ? { emailVerifiedAt: { $ne: null } } : {})
          }
        }
      }
    },
    ...(search
      ? [
          {
            $match: {
              $or: [
                { 'otherUser.name': { $regex: escape(search), $options: 'i' } },
                {
                  profileA: {
                    $elemMatch: {
                      userId: { $ne: oid(userId) },
                      visibility: 'PUBLIC',
                      headline: { $regex: escape(search), $options: 'i' }
                    }
                  }
                },
                {
                  profileB: {
                    $elemMatch: {
                      userId: { $ne: oid(userId) },
                      visibility: 'PUBLIC',
                      headline: { $regex: escape(search), $options: 'i' }
                    }
                  }
                }
              ]
            }
          }
        ]
      : []),
    {
      $lookup: {
        from: 'conversationparticipantstates',
        let: { cid: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $and: [{ $eq: ['$conversationId', '$$cid'] }, { $eq: ['$userId', oid(userId)] }] }
            }
          }
        ],
        as: 'ownState'
      }
    },
    ...(query.includeArchived ? [] : [{ $match: { 'ownState.archived': { $ne: true } } }]),
    { $sort: { activityAt: -1, _id: -1 } },
    { $limit: query.limit + 1 },
    {
      $project: {
        participantAId: 1,
        participantBId: 1,
        lastMessageId: 1,
        lastMessageAt: 1,
        activityAt: 1,
        createdAt: 1,
        updatedAt: 1
      }
    }
  ]);
  const hasMore = records.length > query.limit;
  const page = records.slice(0, query.limit);
  const last = page.at(-1);
  return {
    items: await hydrate(userId, page),
    hasMore,
    nextCursor:
      hasMore && last
        ? Buffer.from(JSON.stringify({ at: last.activityAt.toISOString(), id: hex(last._id) })).toString(
            'base64url'
          )
        : null
  };
}
export async function updatePreferences(
  userId: string,
  conversationId: string,
  input: Partial<ConversationPreferences>
) {
  await assertConversation(userId, conversationId);
  const state = await ConversationParticipantState.findOneAndUpdate(
    { conversationId: oid(conversationId), userId: oid(userId) },
    { $set: input },
    { new: true, upsert: true, runValidators: true }
  );
  return { muted: state.muted, archived: state.archived };
}
export async function getPrivacy(userId: string): Promise<MessagingPrivacySettings> {
  const profile = await Profile.findOne({ userId: oid(userId) })
    .select('allowDirectMessages showReadReceipts showOnlineStatus')
    .lean();
  if (!profile) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile unavailable.');
  return {
    allowDirectMessages: profile.allowDirectMessages !== false,
    showReadReceipts: profile.showReadReceipts === true,
    showOnlineStatus: profile.showOnlineStatus !== false
  };
}
export async function updatePrivacy(userId: string, input: Partial<MessagingPrivacySettings>) {
  const profile = await Profile.findOneAndUpdate(
    { userId: oid(userId) },
    { $set: input },
    { new: true, runValidators: true }
  );
  if (!profile) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile unavailable.');
  await publishPrivacyChanged(userId);
  return getPrivacy(userId);
}
export async function blockUser(userId: string, targetId: string) {
  if (userId === targetId) throw new AppError(400, 'SELF_BLOCK', 'You cannot block yourself.');
  if (!(await User.exists({ _id: oid(targetId) })))
    throw new AppError(404, 'USER_NOT_FOUND', 'User unavailable.');
  await UserBlock.updateOne(
    { blockerId: oid(userId), blockedId: oid(targetId) },
    { $setOnInsert: { blockerId: oid(userId), blockedId: oid(targetId) } },
    { upsert: true }
  );
  await publishAccessChanged(userId, targetId);
  return { blocked: true };
}
export async function unblockUser(userId: string, targetId: string) {
  await UserBlock.deleteOne({ blockerId: oid(userId), blockedId: oid(targetId) });
  return { blocked: false };
}
export async function blockStatus(userId: string, targetId: string) {
  return { blocked: !!(await UserBlock.exists({ blockerId: oid(userId), blockedId: oid(targetId) })) };
}
