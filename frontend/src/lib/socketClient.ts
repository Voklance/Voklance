import type { ClientToServerEvents, ServerToClientEvents } from '@voklance/shared';
import { io, type Socket } from 'socket.io-client';
export type MessagingSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
let socket: MessagingSocket | null = null;
let activeConversationId: string | null = null;
export function messagingSocket() {
  if (!socket) {
    const base = import.meta.env.VITE_API_BASE_URL?.trim();
    const origin = base && /^https?:\/\//.test(base) ? new URL(base).origin : window.location.origin;
    socket = io(origin, {
      path: '/socket.io',
      withCredentials: true,
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelayMax: 10_000
    });
  }
  return socket;
}
export function disconnectMessagingSocket() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  activeConversationId = null;
}
export function setActiveConversation(id: string | null) {
  activeConversationId = id;
}
export function currentConversation() {
  return activeConversationId;
}
