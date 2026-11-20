import type {
  ConnectionDto,
  NetworkCounts,
  NetworkPage,
  ProfessionalSummary,
  RelativeConnectionStatus
} from '@voklance/shared';
import { Types } from 'mongoose';
import { AppError } from '../../../common/AppError.js';
import { env } from '../../../config/env.js';
import Profile from '../../profiles/model/Profile.js';
import User from '../../users/model/User.js';
import Connection, { type ConnectionRecord } from '../model/Connection.js';
import { isBlocked } from '../../messaging/service/messagingPermissions.js';
import { publishAccessChanged } from '../../../realtime/messagingHub.js';
import { queueNotification } from '../../notifications/service/notificationOutbox.js';
import type { PageQuery } from '../validation/connectionSchemas.js';

type StoredConnection = ConnectionRecord & { _id: Types.ObjectId };
const oid = (value: string) => new Types.ObjectId(value);
const pair = (a: string, b: string) =>
  a < b ? { userLowId: oid(a), userHighId: oid(b) } : { userLowId: oid(b), userHighId: oid(a) };
const hex = (value: Types.ObjectId) => value.toString();
const safeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function toConnection(record: StoredConnection, person?: ProfessionalSummary): ConnectionDto {
  return {
    id: hex(record._id),
    status: record.status,
    requesterId: hex(record.requesterId),
    recipientId: hex(record.recipientId),
    requestedAt: record.requestedAt.toISOString(),
    respondedAt: record.respondedAt?.toISOString() ?? null,
    ...(person ? { person } : {})
  };
}

export async function eligibleProfile(userId: string) {
  const profile = await Profile.findOne({ userId, visibility: 'PUBLIC' }).lean();
  if (!profile) throw new AppError(404, 'PROFESSIONAL_NOT_FOUND', 'Professional unavailable.');
  const owner = await User.findById(userId).select('accountStatus onboardingStatus').lean();
  if (
    !owner ||
    (owner.accountStatus && owner.accountStatus !== 'ACTIVE') ||
    owner.onboardingStatus !== 'COMPLETED'
  )
    throw new AppError(404, 'PROFESSIONAL_NOT_FOUND', 'Professional unavailable.');
  return profile;
}

export async function resolveRecipient(input: { recipientId?: string; recipientUsername?: string }) {
  if (input.recipientId) return input.recipientId;
  const profile = await Profile.findOne({ username: input.recipientUsername, visibility: 'PUBLIC' })
    .select('userId')
    .lean();
  if (!profile) throw new AppError(404, 'PROFESSIONAL_NOT_FOUND', 'Professional unavailable.');
  return hex(profile.userId);
}

export async function sendRequest(requesterId: string, recipientId: string) {
  if (requesterId === recipientId)
    throw new AppError(400, 'SELF_CONNECTION', 'You cannot connect with yourself.');
  if (await isBlocked(requesterId, recipientId))
    throw new AppError(404, 'PROFESSIONAL_NOT_FOUND', 'Professional unavailable.');
  const profile = await eligibleProfile(recipientId);
  if (profile.allowConnectionRequests === false)
    throw new AppError(404, 'PROFESSIONAL_NOT_FOUND', 'Professional unavailable.');
  const key = pair(requesterId, recipientId);
  const now = new Date();
  const existing = await Connection.findOne(key).lean();
  if (existing) {
    if (['pending', 'accepted'].includes(existing.status))
      throw new AppError(409, 'CONNECTION_EXISTS', 'A relationship already exists.');
    const cutoff = new Date(now.getTime() - env.connectionRerequestCooldownHours * 3_600_000);
    const updated = await Connection.findOneAndUpdate(
      { ...key, status: { $in: ['declined', 'cancelled', 'removed'] }, updatedAt: { $lte: cutoff } },
      {
        $set: {
          requesterId: oid(requesterId),
          recipientId: oid(recipientId),
          status: 'pending',
          requestedAt: now,
          respondedAt: null
        }
      },
      { new: true, runValidators: true }
    );
    if (!updated)
      throw new AppError(409, 'REREQUEST_COOLDOWN', 'Please wait before sending another request.');
    await queueNotification({
      recipientId,
      actorId: requesterId,
      type: 'CONNECTION_REQUEST_RECEIVED',
      entityType: 'connection_request',
      entityId: hex(updated._id),
      deduplicationKey: `connection:${hex(updated._id)}:requested:${updated.requestedAt.toISOString()}`
    });
    return toConnection(updated);
  }
  try {
    const created = await Connection.create({
      ...key,
      requesterId: oid(requesterId),
      recipientId: oid(recipientId),
      status: 'pending',
      requestedAt: now
    });
    await queueNotification({
      recipientId,
      actorId: requesterId,
      type: 'CONNECTION_REQUEST_RECEIVED',
      entityType: 'connection_request',
      entityId: hex(created._id),
      deduplicationKey: `connection:${hex(created._id)}:requested:${created.requestedAt.toISOString()}`
    });
    return toConnection(created);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000)
      throw new AppError(409, 'CONNECTION_EXISTS', 'A relationship already exists.');
    throw error;
  }
}

export async function transition(
  userId: string,
  id: string,
  action: 'accept' | 'decline' | 'cancel' | 'remove'
) {
  const status =
    action === 'accept'
      ? 'accepted'
      : action === 'decline'
        ? 'declined'
        : action === 'cancel'
          ? 'cancelled'
          : 'removed';
  const filter =
    action === 'remove'
      ? {
          _id: oid(id),
          status: 'accepted',
          $or: [{ requesterId: oid(userId) }, { recipientId: oid(userId) }]
        }
      : {
          _id: oid(id),
          status: 'pending',
          [action === 'cancel' ? 'requesterId' : 'recipientId']: oid(userId)
        };
  const updated = await Connection.findOneAndUpdate(
    filter,
    { $set: { status, respondedAt: new Date() } },
    { new: true }
  );
  if (!updated) throw new AppError(404, 'CONNECTION_NOT_FOUND', 'Connection request unavailable.');
  if (action === 'remove')
    void publishAccessChanged(hex(updated.requesterId), hex(updated.recipientId)).catch(() => undefined);
  if (action === 'accept')
    await queueNotification({
      recipientId: hex(updated.requesterId),
      actorId: hex(updated.recipientId),
      type: 'CONNECTION_REQUEST_ACCEPTED',
      entityType: 'connection_request',
      entityId: hex(updated._id),
      deduplicationKey: `connection:${hex(updated._id)}:accepted:${updated.respondedAt?.toISOString() ?? ''}`
    });
  return toConnection(updated);
}

export async function relativeStatus(
  userId: string,
  otherId: string
): Promise<{ status: RelativeConnectionStatus; requestId: string | null }> {
  if (userId === otherId) return { status: 'none', requestId: null };
  const record = await Connection.findOne(pair(userId, otherId)).select('status requesterId').lean();
  if (!record || !['pending', 'accepted'].includes(record.status)) return { status: 'none', requestId: null };
  return {
    status:
      record.status === 'accepted'
        ? 'connected'
        : hex(record.requesterId) === userId
          ? 'pending_sent'
          : 'pending_received',
    requestId: hex(record._id)
  };
}

export async function networkCounts(userId: string): Promise<NetworkCounts> {
  const [connections, incoming, sent] = await Promise.all([
    Connection.countDocuments({
      status: 'accepted',
      $or: [{ userLowId: oid(userId) }, { userHighId: oid(userId) }]
    }),
    Connection.countDocuments({ recipientId: oid(userId), status: 'pending' }),
    Connection.countDocuments({ requesterId: oid(userId), status: 'pending' })
  ]);
  return { connections, incoming, sent };
}

export async function profileNetwork(viewerId: string, username: string) {
  const profile = await Profile.findOne({ username, visibility: 'PUBLIC' })
    .select('userId connectionListVisibility')
    .lean();
  if (!profile) throw new AppError(404, 'PROFESSIONAL_NOT_FOUND', 'Professional unavailable.');
  await eligibleProfile(hex(profile.userId));
  const relationship = await relativeStatus(viewerId, hex(profile.userId));
  const canSeeCount =
    viewerId === hex(profile.userId) ||
    (profile.connectionListVisibility === 'connections' && relationship.status === 'connected');
  return {
    ...relationship,
    connectionCount: canSeeCount ? (await networkCounts(hex(profile.userId))).connections : null,
    isSelf: viewerId === hex(profile.userId)
  };
}

function readCursor(cursor: string | undefined): { at: Date; id: Types.ObjectId } | null {
  if (!cursor) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('at' in parsed) ||
      !('id' in parsed) ||
      typeof parsed.at !== 'string' ||
      typeof parsed.id !== 'string' ||
      !Types.ObjectId.isValid(parsed.id)
    )
      throw new Error();
    const at = new Date(parsed.at);
    if (Number.isNaN(at.getTime())) throw new Error();
    return { at, id: oid(parsed.id) };
  } catch {
    throw new AppError(400, 'INVALID_CURSOR', 'Invalid page cursor.');
  }
}

export async function summaries(
  viewerId: string,
  userIds: string[]
): Promise<Map<string, ProfessionalSummary>> {
  if (!userIds.length) return new Map();
  const [profiles, activeUsers, relationships, accepted] = await Promise.all([
    Profile.find({ userId: { $in: userIds }, visibility: 'PUBLIC' })
      .select('userId username fullName headline city country connectionListVisibility')
      .lean(),
    User.find({
      _id: { $in: userIds },
      $or: [{ accountStatus: 'ACTIVE' }, { accountStatus: { $exists: false } }],
      onboardingStatus: 'COMPLETED'
    })
      .select('_id')
      .lean(),
    Connection.find({
      status: { $in: ['pending', 'accepted'] },
      $or: [
        { userLowId: oid(viewerId), userHighId: { $in: userIds.map(oid) } },
        { userHighId: oid(viewerId), userLowId: { $in: userIds.map(oid) } }
      ]
    })
      .select('userLowId userHighId status requesterId')
      .lean(),
    Connection.aggregate<{ _id: Types.ObjectId; count: number }>([
      {
        $match: {
          status: 'accepted',
          $or: [{ userLowId: { $in: userIds.map(oid) } }, { userHighId: { $in: userIds.map(oid) } }]
        }
      },
      { $project: { ids: ['$userLowId', '$userHighId'] } },
      { $unwind: '$ids' },
      { $match: { ids: { $in: userIds.map(oid) } } },
      { $group: { _id: '$ids', count: { $sum: 1 } } }
    ])
  ]);
  const active = new Set(activeUsers.map((user) => hex(user._id)));
  const counts = new Map(accepted.map((item) => [hex(item._id), item.count]));
  const relations = new Map(
    relationships.map((item) => [
      hex(item.userLowId) === viewerId ? hex(item.userHighId) : hex(item.userLowId),
      item
    ])
  );
  const result = new Map<string, ProfessionalSummary>();
  for (const profile of profiles) {
    const id = hex(profile.userId);
    if (!active.has(id)) continue;
    const relation = relations.get(id);
    const connectionStatus: RelativeConnectionStatus =
      relation?.status === 'accepted'
        ? 'connected'
        : relation?.status === 'pending'
          ? hex(relation.requesterId) === viewerId
            ? 'pending_sent'
            : 'pending_received'
          : 'none';
    result.set(id, {
      userId: id,
      username: profile.username,
      fullName: profile.fullName,
      headline: profile.headline,
      ...(profile.city ? { city: profile.city } : {}),
      country: profile.country,
      skills: [],
      connectionStatus,
      connectionCount:
        profile.connectionListVisibility === 'connections' && connectionStatus === 'connected'
          ? (counts.get(id) ?? 0)
          : null
    });
  }
  return result;
}

export async function listRequests(
  userId: string,
  direction: 'incoming' | 'sent',
  query: PageQuery
): Promise<NetworkPage<ConnectionDto>> {
  const field = direction === 'incoming' ? 'recipientId' : 'requesterId';
  const cursor = readCursor(query.cursor);
  const records = await Connection.find({
    [field]: oid(userId),
    status: 'pending',
    ...(cursor
      ? { $or: [{ requestedAt: { $lt: cursor.at } }, { requestedAt: cursor.at, _id: { $lt: cursor.id } }] }
      : {})
  })
    .sort({ requestedAt: -1, _id: -1 })
    .limit(query.limit + 1)
    .lean();
  const hasMore = records.length > query.limit;
  const page = records.slice(0, query.limit);
  const people = await summaries(
    userId,
    page.map((item) => hex(direction === 'incoming' ? item.requesterId : item.recipientId))
  );
  const last = page.at(-1);
  return {
    items: page.map((item) =>
      toConnection(item, people.get(hex(direction === 'incoming' ? item.requesterId : item.recipientId)))
    ),
    hasMore,
    nextCursor:
      hasMore && last
        ? Buffer.from(JSON.stringify({ at: last.requestedAt.toISOString(), id: hex(last._id) })).toString(
            'base64url'
          )
        : null
  };
}

export async function listConnections(userId: string, query: PageQuery) {
  const cursor = query.cursor;
  if (cursor && !Types.ObjectId.isValid(cursor))
    throw new AppError(400, 'INVALID_CURSOR', 'Invalid page cursor.');
  const match = {
    status: 'accepted',
    $or: [{ userLowId: oid(userId) }, { userHighId: oid(userId) }],
    ...(cursor ? { _id: { $lt: oid(cursor) } } : {})
  };
  const search = query.search?.trim();
  const rows = await Connection.aggregate<StoredConnection>([
    { $match: match },
    { $sort: { _id: -1 } },
    ...(search
      ? [
          {
            $addFields: {
              otherId: { $cond: [{ $eq: ['$userLowId', oid(userId)] }, '$userHighId', '$userLowId'] }
            }
          },
          {
            $lookup: { from: 'profiles', localField: 'otherId', foreignField: 'userId', as: 'otherProfile' }
          },
          {
            $match: {
              otherProfile: {
                $elemMatch: { visibility: 'PUBLIC', fullName: { $regex: safeRegex(search), $options: 'i' } }
              }
            }
          }
        ]
      : []),
    { $limit: query.limit + 1 }
  ]);
  const hasMore = rows.length > query.limit;
  const page = rows.slice(0, query.limit);
  const people = await summaries(
    userId,
    page.map((item) => hex(hex(item.userLowId) === userId ? item.userHighId : item.userLowId))
  );
  const counts = await networkCounts(userId);
  return {
    items: page.map((item) =>
      toConnection(item, people.get(hex(hex(item.userLowId) === userId ? item.userHighId : item.userLowId)))
    ),
    hasMore,
    nextCursor: hasMore && page.length ? hex(page[page.length - 1]._id) : null,
    counts
  };
}

export async function visibleConnections(
  viewerId: string,
  username: string,
  query: PageQuery
): Promise<NetworkPage<ProfessionalSummary>> {
  const profile = await Profile.findOne({ username, visibility: 'PUBLIC' })
    .select('userId connectionListVisibility')
    .lean();
  if (!profile) throw new AppError(404, 'PROFESSIONAL_NOT_FOUND', 'Professional unavailable.');
  const subjectId = hex(profile.userId);
  await eligibleProfile(subjectId);
  if (viewerId !== subjectId) {
    const relationship = await relativeStatus(viewerId, subjectId);
    if (profile.connectionListVisibility !== 'connections' || relationship.status !== 'connected')
      throw new AppError(404, 'CONNECTION_LIST_NOT_FOUND', 'Connection list unavailable.');
  }
  if (query.cursor && !Types.ObjectId.isValid(query.cursor))
    throw new AppError(400, 'INVALID_CURSOR', 'Invalid page cursor.');
  const rows = await Connection.aggregate<{ _id: Types.ObjectId; otherId: Types.ObjectId }>([
    {
      $match: {
        status: 'accepted',
        $or: [{ userLowId: oid(subjectId) }, { userHighId: oid(subjectId) }],
        ...(query.cursor ? { _id: { $lt: oid(query.cursor) } } : {})
      }
    },
    {
      $addFields: {
        otherId: { $cond: [{ $eq: ['$userLowId', oid(subjectId)] }, '$userHighId', '$userLowId'] }
      }
    },
    { $lookup: { from: 'profiles', localField: 'otherId', foreignField: 'userId', as: 'otherProfile' } },
    { $match: { 'otherProfile.visibility': 'PUBLIC' } },
    { $lookup: { from: 'users', localField: 'otherId', foreignField: '_id', as: 'owner' } },
    {
      $match: {
        owner: {
          $elemMatch: {
            onboardingStatus: 'COMPLETED',
            $or: [{ accountStatus: 'ACTIVE' }, { accountStatus: { $exists: false } }]
          }
        }
      }
    },
    { $sort: { _id: -1 } },
    { $limit: query.limit + 1 },
    { $project: { otherId: 1 } }
  ]);
  const hasMore = rows.length > query.limit;
  const page = rows.slice(0, query.limit);
  const people = await summaries(
    viewerId,
    page.map((item) => hex(item.otherId))
  );
  return {
    items: page.flatMap((item) => {
      const person = people.get(hex(item.otherId));
      return person ? [person] : [];
    }),
    hasMore,
    nextCursor: hasMore && page.length ? hex(page[page.length - 1]._id) : null
  };
}
