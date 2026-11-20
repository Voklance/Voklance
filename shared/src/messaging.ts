import type { NotificationSocketEvents } from './notifications.js';
export const MESSAGE_LIMIT = 2000;
export const MESSAGE_REPORT_REASONS = [
  'spam',
  'harassment',
  'impersonation',
  'suspicious_links',
  'inappropriate',
  'other'
] as const;
export type MessageReportReason = (typeof MESSAGE_REPORT_REASONS)[number];
export interface MessagingPrivacySettings {
  allowDirectMessages: boolean;
  showReadReceipts: boolean;
  showOnlineStatus: boolean;
}
export interface ConversationPreferences {
  muted: boolean;
  archived: boolean;
}
export interface MessagePerson {
  userId: string;
  name: string;
  username: string | null;
  headline: string | null;
}
export interface MessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  clientMessageId: string;
  createdAt: string;
}
export interface ConversationDto {
  id: string;
  person: MessagePerson;
  lastMessage: MessageDto | null;
  lastMessageAt: string | null;
  unreadCount: number;
  preferences: ConversationPreferences;
  otherLastReadMessageId: string | null;
  createdAt: string;
}
export interface MessagePage {
  items: MessageDto[];
  nextCursor: string | null;
  hasMore: boolean;
}
export interface ConversationPage {
  items: ConversationDto[];
  nextCursor: string | null;
  hasMore: boolean;
}
export interface MessageSendPayload {
  conversationId: string;
  clientMessageId: string;
  body: string;
}
export interface MessageReadPayload {
  conversationId: string;
  messageId: string;
}
export interface TypingPayload {
  conversationId: string;
}
export interface PresencePayload {
  userId: string;
}
export interface SocketFailure {
  ok: false;
  code: string;
  message: string;
}
export interface SocketSuccess<T> {
  ok: true;
  data: T;
}
export type SocketResult<T> = SocketFailure | SocketSuccess<T>;
export interface ClientToServerEvents {
  'conversation:join': (
    payload: { conversationId: string },
    ack: (result: SocketResult<{ conversationId: string }>) => void
  ) => void;
  'conversation:leave': (
    payload: { conversationId: string },
    ack: (result: SocketResult<{ conversationId: string }>) => void
  ) => void;
  'message:send': (
    payload: MessageSendPayload,
    ack: (result: SocketResult<{ message: MessageDto }>) => void
  ) => void;
  'message:read': (
    payload: MessageReadPayload,
    ack: (result: SocketResult<{ messageId: string }>) => void
  ) => void;
  'typing:start': (
    payload: TypingPayload,
    ack: (result: SocketResult<Record<string, never>>) => void
  ) => void;
  'typing:stop': (payload: TypingPayload, ack: (result: SocketResult<Record<string, never>>) => void) => void;
  'presence:subscribe': (
    payload: PresencePayload,
    ack: (result: SocketResult<{ online: boolean }>) => void
  ) => void;
  'presence:unsubscribe': (
    payload: PresencePayload,
    ack: (result: SocketResult<Record<string, never>>) => void
  ) => void;
}
export interface ServerToClientEvents extends NotificationSocketEvents {
  'message:new': (message: MessageDto) => void;
  'message:ack': (message: MessageDto) => void;
  'message:error': (failure: SocketFailure) => void;
  'message:read': (payload: {
    conversationId: string;
    userId: string;
    messageId: string;
    readAt: string;
  }) => void;
  'typing:started': (payload: { conversationId: string; userId: string }) => void;
  'typing:stopped': (payload: { conversationId: string; userId: string }) => void;
  'presence:changed': (payload: { userId: string; online: boolean }) => void;
  'conversation:updated': (payload: { conversationId: string; accessRevoked?: boolean }) => void;
  'message:unread-count': (payload: { count: number }) => void;
}
