import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
  type NotificationDto,
  type NotificationEntityType,
  type NotificationPage,
  type NotificationPreferences,
  type NotificationType
} from '@voklance/shared';
import { Types } from 'mongoose';
import { AppError } from '../../../common/AppError.js';
import {
  publishNotificationCount,
  publishNotificationCreated,
  publishNotificationUpdated
} from '../../../realtime/notificationHub.js';
import User from '../../users/model/User.js';
import Notification, { type NotificationRecord } from '../model/Notification.js';
import NotificationPreference from '../model/NotificationPreference.js';

const oid = (id: string) => new Types.ObjectId(id);
const templates: Record<NotificationType, { category: NotificationCategory; title: string; body: string }> = {
  CONNECTION_REQUEST_RECEIVED: {
    category: 'network',
    title: 'Connection request',
    body: 'A professional sent you a connection request.'
  },
  CONNECTION_REQUEST_ACCEPTED: {
    category: 'network',
    title: 'Connection accepted',
    body: 'A professional accepted your connection request.'
  },
  REFERRAL_REQUEST_RECEIVED: {
    category: 'referrals',
    title: 'Referral request',
    body: 'You received a referral request.'
  },
  REFERRAL_RESPONSE_RECEIVED: {
    category: 'referrals',
    title: 'Referral response',
    body: 'Someone responded to your referral.'
  },
  REFERRAL_STATUS_UPDATED: {
    category: 'referrals',
    title: 'Referral update',
    body: 'The status of a referral changed.'
  },
  EVENT_REGISTRATION_RECEIVED: {
    category: 'events',
    title: 'Event registration',
    body: 'Someone registered for your event.'
  },
  EVENT_UPDATED: { category: 'events', title: 'Event updated', body: 'An event you joined was updated.' },
  EVENT_CANCELLED: {
    category: 'events',
    title: 'Event cancelled',
    body: 'An event you joined was cancelled.'
  },
  MEETUP_RSVP_RECEIVED: {
    category: 'events',
    title: 'Meetup RSVP',
    body: 'Someone responded to your meetup.'
  },
  MEETUP_UPDATED: { category: 'events', title: 'Meetup updated', body: 'A meetup you joined was updated.' },
  COMMUNITY_JOIN_REQUEST_RECEIVED: {
    category: 'communities',
    title: 'Community request',
    body: 'Someone asked to join your community.'
  },
  COMMUNITY_MEMBERSHIP_APPROVED: {
    category: 'communities',
    title: 'Community approved',
    body: 'Your community membership was approved.'
  },
  COMMUNITY_MEMBERSHIP_REJECTED: {
    category: 'communities',
    title: 'Community request declined',
    body: 'Your community membership request was declined.'
  },
  COMMUNITY_RESOURCE_PUBLISHED: {
    category: 'resources',
    title: 'New community resource',
    body: 'A resource was published in one of your communities.'
  },
  COMMUNITY_RESOURCE_REMOVED: {
    category: 'resources',
    title: 'Community resource removed',
    body: 'A community resource was removed.'
  },
  POST_LIKED: { category: 'feed', title: 'Post liked', body: 'Someone liked your post.' },
  POST_COMMENTED: { category: 'feed', title: 'Post comment', body: 'Someone commented on your post.' },
  POST_COMMENT_REPLIED: {
    category: 'feed',
    title: 'Comment reply',
    body: 'Someone replied to your comment.'
  },
  MESSAGE_RECEIVED: { category: 'messages', title: 'New message', body: 'A professional sent you a message.' }
};
type Stored = NotificationRecord & { _id: Types.ObjectId };
export function toNotification(record: Stored): NotificationDto {
  return {
    id: record._id.toString(),
    type: record.type,
    category: record.category,
    title: record.title,
    body: record.body,
    actorId: record.actorId?.toString() ?? null,
    entityType: record.entityType,
    entityId: record.entityId.toString(),
    readAt: record.readAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString()
  };
}
export async function getPreferences(userId: string): Promise<NotificationPreferences> {
  const rows = await NotificationPreference.find({ userId: oid(userId) })
    .select('category inAppEnabled')
    .lean();
  const preferences = Object.fromEntries(
    NOTIFICATION_CATEGORIES.map((category) => [category, true])
  ) as NotificationPreferences;
  for (const row of rows) preferences[row.category] = row.inAppEnabled;
  return preferences;
}
export async function savePreferences(userId: string, patch: Partial<NotificationPreferences>) {
  await Promise.all(
    Object.entries(patch).map(([category, enabled]) =>
      NotificationPreference.updateOne(
        { userId: oid(userId), category },
        { $set: { inAppEnabled: enabled } },
        { upsert: true, runValidators: true }
      )
    )
  );
  return getPreferences(userId);
}
export async function unreadCount(userId: string) {
  return Notification.countDocuments({ recipientId: oid(userId), readAt: null });
}
export async function createNotification(input: {
  recipientId: string;
  actorId?: string;
  type: NotificationType;
  entityType: NotificationEntityType;
  entityId: string;
  deduplicationKey: string;
}): Promise<NotificationDto | null> {
  if (input.actorId === input.recipientId) return null;
  const template = templates[input.type];
  if (!template || !Types.ObjectId.isValid(input.entityId) || !Types.ObjectId.isValid(input.recipientId))
    throw new AppError(400, 'NOTIFICATION_INVALID', 'Invalid notification event.');
  const [recipient, disabled] = await Promise.all([
    User.exists({
      _id: oid(input.recipientId),
      $or: [{ accountStatus: 'ACTIVE' }, { accountStatus: { $exists: false } }]
    }),
    NotificationPreference.exists({
      userId: oid(input.recipientId),
      category: template.category,
      inAppEnabled: false
    })
  ]);
  if (!recipient || disabled) return null;
  let record: Stored;
  try {
    record = await Notification.create({
      recipientId: oid(input.recipientId),
      actorId: input.actorId ? oid(input.actorId) : null,
      type: input.type,
      category: template.category,
      entityType: input.entityType,
      entityId: oid(input.entityId),
      title: template.title,
      body: template.body,
      deduplicationKey: input.deduplicationKey
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) return null;
    throw error;
  }
  const dto = toNotification(record);
  try {
    await publishNotificationCreated(input.recipientId, dto);
  } catch {
    /* Persistence remains authoritative; reconnect reloads it. */
  }
  return dto;
}
export async function listNotifications(
  userId: string,
  query: { category?: NotificationCategory; unreadOnly?: boolean; limit: number; cursor?: string }
): Promise<NotificationPage> {
  const rows = await Notification.find({
    recipientId: oid(userId),
    ...(query.category ? { category: query.category } : {}),
    ...(query.unreadOnly ? { readAt: null } : {}),
    ...(query.cursor ? { _id: { $lt: oid(query.cursor) } } : {})
  })
    .sort({ _id: -1 })
    .limit(query.limit + 1)
    .lean();
  const hasMore = rows.length > query.limit;
  const page = rows.slice(0, query.limit);
  return {
    items: page.map(toNotification),
    hasMore,
    nextCursor: hasMore && page.length ? page.at(-1)!._id.toString() : null
  };
}
export async function markRead(userId: string, notificationId: string) {
  const at = new Date();
  const record = await Notification.findOneAndUpdate(
    { _id: oid(notificationId), recipientId: oid(userId), readAt: null },
    { $set: { readAt: at } },
    { new: true }
  );
  if (record) {
    try {
      await publishNotificationUpdated(userId, notificationId, at.toISOString());
    } catch {
      /* REST remains authoritative. */
    }
    return toNotification(record);
  }
  const existing = await Notification.findOne({ _id: oid(notificationId), recipientId: oid(userId) }).lean();
  if (!existing) throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification unavailable.');
  return toNotification(existing);
}
export async function markAllRead(userId: string, category?: NotificationCategory) {
  const result = await Notification.updateMany(
    { recipientId: oid(userId), readAt: null, ...(category ? { category } : {}) },
    { $set: { readAt: new Date() } }
  );
  try {
    await publishNotificationCount(userId);
  } catch {
    /* REST remains authoritative. */
  }
  return { affectedCount: result.modifiedCount, unreadCount: await unreadCount(userId) };
}
