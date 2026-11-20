import type { Server as HttpServer } from 'node:http';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketFailure,
  SocketResult
} from '@voklance/shared';
import mongoose from 'mongoose';
import { Server, type Socket } from 'socket.io';
import { AppError } from '../common/AppError.js';
import { isAllowedOrigin } from '../config/env.js';
import { getCurrentUser, hashToken, sessionCookieName } from '../modules/auth/service/authService.js';
import Conversation from '../modules/messaging/model/Conversation.js';
import { unreadCount as notificationUnreadCount } from '../modules/notifications/service/notificationService.js';
import { getPrivacy, unreadCounts } from '../modules/messaging/service/conversationService.js';
import {
  assertConversation,
  canSeePresence,
  hex,
  pair
} from '../modules/messaging/service/messagingPermissions.js';
import { readMessage, sendMessage } from '../modules/messaging/service/messageService.js';
import {
  conversationIdPayload,
  presencePayload,
  socketRead,
  socketSend
} from '../modules/messaging/validation/messagingSchemas.js';
import { setMessagingPublisher } from './messagingHub.js';
import { setNotificationPublisher } from './notificationHub.js';
import { ZodError } from 'zod';

type SocketData = {
  userId: string;
  token: string;
  joined: Set<string>;
  presence: Set<string>;
  limits: Map<string, { count: number; start: number }>;
  lastTyping: Map<string, number>;
};
type MessagingServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type MessagingSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
let activeServer: MessagingServer | null = null;
const activeUsers = new Map<string, Set<string>>();
const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const userRoom = (id: string) => `user:${id}`;
const conversationRoom = (id: string) => `conversation:${id}`;
const presenceRoom = (id: string) => `presence:${id}`;
function cookieValue(header: string | undefined, name: string) {
  const segment = header
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!segment) return undefined;
  try {
    return decodeURIComponent(segment.slice(name.length + 1));
  } catch {
    return undefined;
  }
}
function failure(error: unknown): SocketFailure {
  if (error instanceof AppError) return { ok: false, code: error.code, message: error.message };
  if (error instanceof ZodError)
    return { ok: false, code: 'VALIDATION_ERROR', message: 'Invalid event payload.' };
  return { ok: false, code: 'SOCKET_ERROR', message: 'Messaging is temporarily unavailable.' };
}
function limit(socket: MessagingSocket, key: string, max: number, windowMs: number) {
  const now = Date.now();
  const previous = socket.data.limits.get(key);
  const entry =
    !previous || now - previous.start >= windowMs
      ? { count: 1, start: now }
      : { count: previous.count + 1, start: previous.start };
  socket.data.limits.set(key, entry);
  if (entry.count > max) throw new AppError(429, 'RATE_LIMITED', 'Too many real-time actions.');
}
async function authorized(socket: MessagingSocket) {
  const account = await getCurrentUser(socket.data.token);
  if (
    account.id !== socket.data.userId ||
    account.onboardingStatus !== 'COMPLETED' ||
    (account.emailVerificationRequired && !account.emailVerifiedAt)
  )
    throw new AppError(401, 'SESSION_EXPIRED', 'Session unavailable.');
}
function handle<T>(socket: MessagingSocket, ack: unknown, action: () => Promise<T>) {
  void (async () => {
    try {
      await authorized(socket);
      const data = await action();
      if (typeof ack === 'function') (ack as (result: SocketResult<T>) => void)({ ok: true, data });
    } catch (error) {
      const result = failure(error);
      if (typeof ack === 'function') (ack as (result: SocketResult<T>) => void)(result);
      else socket.emit('message:error', result);
      if (result.code === 'SESSION_EXPIRED' || result.code === 'UNAUTHENTICATED') socket.disconnect(true);
    }
  })();
}
async function announcePresence(io: MessagingServer, targetId: string) {
  const online = (activeUsers.get(targetId)?.size ?? 0) > 0;
  const sockets = await io.in(presenceRoom(targetId)).fetchSockets();
  for (const socket of sockets) {
    const viewerId = socket.data.userId;
    if (!viewerId || !(await canSeePresence(viewerId, targetId))) {
      socket.leave(presenceRoom(targetId));
      socket.emit('presence:changed', { userId: targetId, online: false });
      continue;
    }
    socket.emit('presence:changed', { userId: targetId, online });
  }
}
function clearTyping(socket: MessagingSocket, conversationId: string) {
  const key = `${socket.id}:${conversationId}`;
  const timer = typingTimers.get(key);
  if (timer) clearTimeout(timer);
  typingTimers.delete(key);
  socket
    .to(conversationRoom(conversationId))
    .emit('typing:stopped', { conversationId, userId: socket.data.userId });
}
export function disconnectSessionSockets(token: string | undefined) {
  if (!token || !activeServer) return;
  for (const socket of activeServer.sockets.sockets.values())
    if (socket.data.token === token) socket.disconnect(true);
}
export function disconnectUserSockets(userId: string, keepToken?: string) {
  if (!activeServer) return;
  for (const socket of activeServer.sockets.sockets.values())
    if (socket.data.userId === userId && socket.data.token !== keepToken) socket.disconnect(true);
}
export function disconnectSessionHash(tokenHash: string) {
  if (!activeServer) return;
  for (const socket of activeServer.sockets.sockets.values())
    if (socket.data.token && hashToken(socket.data.token) === tokenHash) socket.disconnect(true);
}
export function attachSocketServer(httpServer: HttpServer) {
  const io: MessagingServer = new Server(httpServer, {
    path: '/socket.io',
    maxHttpBufferSize: 16_384,
    pingTimeout: 20_000,
    cors: {
      origin: (origin, callback) =>
        origin && isAllowedOrigin(origin) ? callback(null, true) : callback(new Error('Origin not allowed')),
      credentials: true
    },
    allowRequest: (request, callback) =>
      callback(
        null,
        !!request.headers.origin &&
          isAllowedOrigin(request.headers.origin) &&
          mongoose.connection.readyState === 1
      )
  });
  activeServer = io;
  io.use(async (socket, next) => {
    try {
      const token = cookieValue(socket.request.headers.cookie, sessionCookieName);
      const user = await getCurrentUser(token);
      if (user.onboardingStatus !== 'COMPLETED' || (user.emailVerificationRequired && !user.emailVerifiedAt))
        throw new AppError(403, 'ONBOARDING_REQUIRED', 'Account unavailable.');
      socket.data.userId = user.id;
      socket.data.token = token ?? '';
      socket.data.joined = new Set();
      socket.data.presence = new Set();
      socket.data.limits = new Map();
      socket.data.lastTyping = new Map();
      next();
    } catch {
      next(new Error('UNAUTHENTICATED'));
    }
  });
  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    socket.join(userRoom(userId));
    const sockets = activeUsers.get(userId) ?? new Set<string>();
    sockets.add(socket.id);
    activeUsers.set(userId, sockets);
    if (sockets.size === 1) void announcePresence(io, userId);
    const allowedEvents = new Set([
      'conversation:join',
      'conversation:leave',
      'message:send',
      'message:read',
      'typing:start',
      'typing:stop',
      'presence:subscribe',
      'presence:unsubscribe'
    ]);
    socket.onAny((event) => {
      if (!allowedEvents.has(event)) {
        try {
          limit(socket, 'invalid', 5, 60_000);
        } catch {
          socket.disconnect(true);
        }
      }
    });
    socket.on('conversation:join', (payload, ack) =>
      handle(socket, ack, async () => {
        limit(socket, 'join', 30, 60_000);
        const { conversationId } = conversationIdPayload.parse(payload);
        await assertConversation(userId, conversationId);
        if (socket.data.joined.size >= 10 && !socket.data.joined.has(conversationId))
          throw new AppError(429, 'ROOM_LIMIT', 'Too many open conversations.');
        socket.join(conversationRoom(conversationId));
        socket.data.joined.add(conversationId);
        return { conversationId };
      })
    );
    socket.on('conversation:leave', (payload, ack) =>
      handle(socket, ack, async () => {
        const { conversationId } = conversationIdPayload.parse(payload);
        socket.leave(conversationRoom(conversationId));
        socket.data.joined.delete(conversationId);
        clearTyping(socket, conversationId);
        return { conversationId };
      })
    );
    socket.on('message:send', (payload, ack) =>
      handle(socket, ack, async () => {
        limit(socket, 'send', 30, 60_000);
        const input = socketSend.parse(payload);
        const result = await sendMessage(
          userId,
          input.conversationId,
          input.body,
          input.clientMessageId,
          socket.id
        );
        return { message: result.message };
      })
    );
    socket.on('message:read', (payload, ack) =>
      handle(socket, ack, async () => {
        limit(socket, 'read', 60, 60_000);
        const input = socketRead.parse(payload);
        const result = await readMessage(userId, input.conversationId, input.messageId);
        return { messageId: result.messageId };
      })
    );
    for (const action of ['start', 'stop'] as const)
      socket.on(`typing:${action}`, (payload, ack) =>
        handle(socket, ack, async () => {
          limit(socket, 'typing', 20, 10_000);
          const { conversationId } = conversationIdPayload.parse(payload);
          await assertConversation(userId, conversationId);
          if (!socket.data.joined.has(conversationId))
            throw new AppError(403, 'ROOM_NOT_JOINED', 'Open the conversation first.');
          if (action === 'stop') clearTyping(socket, conversationId);
          else {
            const now = Date.now();
            const previous = socket.data.lastTyping.get(conversationId) ?? 0;
            if (now - previous >= 1_000) {
              socket.to(conversationRoom(conversationId)).emit('typing:started', { conversationId, userId });
              socket.data.lastTyping.set(conversationId, now);
            }
            const key = `${socket.id}:${conversationId}`;
            const timer = typingTimers.get(key);
            if (timer) clearTimeout(timer);
            typingTimers.set(
              key,
              setTimeout(() => clearTyping(socket, conversationId), 4_000)
            );
          }
          return {};
        })
      );
    socket.on('presence:subscribe', (payload, ack) =>
      handle(socket, ack, async () => {
        limit(socket, 'presence', 20, 60_000);
        const { userId: targetId } = presencePayload.parse(payload);
        if (!(await canSeePresence(userId, targetId)))
          throw new AppError(404, 'PRESENCE_UNAVAILABLE', 'Presence unavailable.');
        if (socket.data.presence.size >= 25 && !socket.data.presence.has(targetId))
          throw new AppError(429, 'SUBSCRIPTION_LIMIT', 'Too many presence subscriptions.');
        socket.join(presenceRoom(targetId));
        socket.data.presence.add(targetId);
        return { online: (activeUsers.get(targetId)?.size ?? 0) > 0 };
      })
    );
    socket.on('presence:unsubscribe', (payload, ack) =>
      handle(socket, ack, async () => {
        const { userId: targetId } = presencePayload.parse(payload);
        socket.leave(presenceRoom(targetId));
        socket.data.presence.delete(targetId);
        return {};
      })
    );
    socket.on('disconnect', () => {
      for (const id of socket.data.joined) clearTyping(socket, id);
      const current = activeUsers.get(userId);
      current?.delete(socket.id);
      if (current?.size === 0) {
        activeUsers.delete(userId);
        void announcePresence(io, userId);
      }
    });
  });
  const sessionCheck = setInterval(() => {
    for (const socket of io.sockets.sockets.values())
      void authorized(socket).catch(() => socket.disconnect(true));
  }, 60_000);
  sessionCheck.unref();
  setMessagingPublisher({
    async saved(message, senderId, recipientId, _recipientMuted, originSocketId) {
      io.to(userRoom(recipientId)).emit('message:new', message);
      if (originSocketId) io.to(userRoom(senderId)).except(originSocketId).emit('message:ack', message);
      else io.to(userRoom(senderId)).emit('message:ack', message);
      io.to(userRoom(senderId))
        .to(userRoom(recipientId))
        .emit('conversation:updated', { conversationId: message.conversationId });
      const count = (await unreadCounts(recipientId)).count;
      io.to(userRoom(recipientId)).emit('message:unread-count', { count });
    },
    async read(conversationId, readerId, senderId, messageId, readAt, publishReceipt) {
      if (publishReceipt)
        io.to(userRoom(senderId)).emit('message:read', {
          conversationId,
          userId: readerId,
          messageId,
          readAt
        });
      io.to(userRoom(readerId)).emit('message:unread-count', {
        count: (await unreadCounts(readerId)).count
      });
      io.to(userRoom(readerId)).to(userRoom(senderId)).emit('conversation:updated', { conversationId });
    },
    async accessChanged(a, b) {
      const key = pair(a, b);
      const conversation = await Conversation.findOne(key).select('_id').lean();
      if (conversation) {
        const conversationId = hex(conversation._id);
        io.to(userRoom(a))
          .to(userRoom(b))
          .emit('conversation:updated', { conversationId, accessRevoked: true });
        io.in(userRoom(a)).in(userRoom(b)).socketsLeave(conversationRoom(conversationId));
      }
      await Promise.all([announcePresence(io, a), announcePresence(io, b)]);
    },
    async privacyChanged(userId) {
      const privacy = await getPrivacy(userId);
      const conversations = await Conversation.find({
        $or: [{ participantAId: userId }, { participantBId: userId }]
      })
        .select('_id participantAId participantBId')
        .lean();
      for (const conversation of conversations) {
        const id = hex(conversation._id);
        const otherId =
          hex(conversation.participantAId) === userId
            ? hex(conversation.participantBId)
            : hex(conversation.participantAId);
        io.to(userRoom(userId))
          .to(userRoom(otherId))
          .emit('conversation:updated', {
            conversationId: id,
            ...(privacy.allowDirectMessages ? {} : { accessRevoked: true })
          });
        if (!privacy.allowDirectMessages)
          io.in(userRoom(userId)).in(userRoom(otherId)).socketsLeave(conversationRoom(id));
      }
      await announcePresence(io, userId);
    }
  });
  setNotificationPublisher({
    async created(recipientId, notification) {
      io.to(userRoom(recipientId)).emit('notification:new', notification);
      io.to(userRoom(recipientId)).emit('notification:unread-count', {
        unreadCount: await notificationUnreadCount(recipientId)
      });
    },
    async updated(recipientId, notificationId, readAt) {
      io.to(userRoom(recipientId)).emit('notification:updated', { id: notificationId, readAt });
      io.to(userRoom(recipientId)).emit('notification:unread-count', {
        unreadCount: await notificationUnreadCount(recipientId)
      });
    },
    async count(recipientId) {
      io.to(userRoom(recipientId)).emit('notification:unread-count', {
        unreadCount: await notificationUnreadCount(recipientId)
      });
    }
  });
  io.on('close', () => {
    clearInterval(sessionCheck);
    if (activeServer === io) {
      activeServer = null;
      setMessagingPublisher(null);
      setNotificationPublisher(null);
      activeUsers.clear();
    }
  });
  return io;
}
