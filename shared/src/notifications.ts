export const NOTIFICATION_CATEGORIES = [
  'network',
  'referrals',
  'events',
  'communities',
  'resources',
  'feed',
  'messages'
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
export const NOTIFICATION_TYPES = [
  'CONNECTION_REQUEST_RECEIVED',
  'CONNECTION_REQUEST_ACCEPTED',
  'REFERRAL_REQUEST_RECEIVED',
  'REFERRAL_RESPONSE_RECEIVED',
  'REFERRAL_STATUS_UPDATED',
  'EVENT_REGISTRATION_RECEIVED',
  'EVENT_UPDATED',
  'EVENT_CANCELLED',
  'MEETUP_RSVP_RECEIVED',
  'MEETUP_UPDATED',
  'COMMUNITY_JOIN_REQUEST_RECEIVED',
  'COMMUNITY_MEMBERSHIP_APPROVED',
  'COMMUNITY_MEMBERSHIP_REJECTED',
  'COMMUNITY_RESOURCE_PUBLISHED',
  'COMMUNITY_RESOURCE_REMOVED',
  'POST_LIKED',
  'POST_COMMENTED',
  'POST_COMMENT_REPLIED',
  'MESSAGE_RECEIVED'
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export const NOTIFICATION_ENTITY_TYPES = [
  'connection_request',
  'referral',
  'event',
  'community',
  'resource',
  'post',
  'conversation'
] as const;
export type NotificationEntityType = (typeof NOTIFICATION_ENTITY_TYPES)[number];
export interface NotificationDto {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  body: string;
  actorId: string | null;
  entityType: NotificationEntityType;
  entityId: string;
  readAt: string | null;
  createdAt: string;
}
export interface NotificationPage {
  items: NotificationDto[];
  nextCursor: string | null;
  hasMore: boolean;
}
export type NotificationPreferences = Record<NotificationCategory, boolean>;
export interface NotificationSocketEvents {
  'notification:new': (payload: NotificationDto) => void;
  'notification:updated': (payload: { id: string; readAt: string }) => void;
  'notification:unread-count': (payload: { unreadCount: number }) => void;
}
