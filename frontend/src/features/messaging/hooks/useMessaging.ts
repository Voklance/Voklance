import type { ConversationDto, ConversationPage, MessageDto, MessagePage } from '@voklance/shared';
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { clearAuthenticatedCache } from '@/features/auth/cache/authCache';
import { messagingSocket } from '@/lib/socketClient';
import { messagingApi } from '../api/messagingApi';

export const messageKeys = {
  root: ['messages'] as const,
  conversations: (search?: string) => ['messages', 'conversations', search ?? ''] as const,
  conversation: (id: string) => ['messages', 'conversation', id] as const,
  history: (id: string) => ['messages', 'history', id] as const,
  unread: ['messages', 'unread-count'] as const,
  settings: ['messages', 'settings'] as const
};
const next = (page: { hasMore: boolean; nextCursor: string | null }) =>
  page.hasMore ? (page.nextCursor ?? undefined) : undefined;
export function useConversations(search?: string) {
  return useInfiniteQuery({
    queryKey: messageKeys.conversations(search),
    queryFn: ({ pageParam }) => messagingApi.conversations(search, pageParam),
    initialPageParam: '' as string,
    getNextPageParam: next
  });
}
export function useConversation(id: string) {
  return useQuery({
    queryKey: messageKeys.conversation(id),
    queryFn: () => messagingApi.conversation(id),
    enabled: !!id
  });
}
export function useMessages(id: string) {
  return useInfiniteQuery({
    queryKey: messageKeys.history(id),
    queryFn: ({ pageParam }) => messagingApi.messages(id, pageParam),
    initialPageParam: '' as string,
    getNextPageParam: next,
    enabled: !!id
  });
}
export function useUnreadMessageCount() {
  return useQuery({ queryKey: messageKeys.unread, queryFn: messagingApi.unreadCount, staleTime: 30_000 });
}
export function useMessagingSettings() {
  return useQuery({ queryKey: messageKeys.settings, queryFn: messagingApi.settings });
}
export function appendMessageToCache(client: ReturnType<typeof useQueryClient>, message: MessageDto) {
  client.setQueryData<InfiniteData<MessagePage, string>>(
    messageKeys.history(message.conversationId),
    (old) => {
      if (!old?.pages.length) return old;
      if (
        old.pages.some((page) =>
          page.items.some(
            (item) =>
              item.id === message.id ||
              (item.senderId === message.senderId && item.clientMessageId === message.clientMessageId)
          )
        )
      )
        return old;
      return {
        ...old,
        pages: [{ ...old.pages[0], items: [...old.pages[0].items, message] }, ...old.pages.slice(1)]
      };
    }
  );
}
export function useMessagingLifecycle(userId: string) {
  const client = useQueryClient();
  useEffect(() => {
    const socket = messagingSocket();
    const refresh = () => {
      void client.invalidateQueries({ queryKey: messageKeys.root });
    };
    const received = (message: MessageDto) => {
      appendMessageToCache(client, message);
      void client.invalidateQueries({ queryKey: ['messages', 'conversations'] });
      void client.invalidateQueries({ queryKey: messageKeys.unread });
    };
    const updated = (payload: { conversationId: string; accessRevoked?: boolean }) => {
      void client.invalidateQueries({ queryKey: ['messages', 'conversations'] });
      void client.invalidateQueries({ queryKey: messageKeys.conversation(payload.conversationId) });
      void client.invalidateQueries({ queryKey: messageKeys.unread });
      if (payload.accessRevoked)
        void client.invalidateQueries({ queryKey: messageKeys.history(payload.conversationId) });
    };
    const count = (payload: { count: number }) => client.setQueryData(messageKeys.unread, payload);
    const authError = (error: Error) => {
      if (error.message === 'UNAUTHENTICATED') void clearAuthenticatedCache(client);
    };
    socket.on('connect', refresh);
    socket.on('message:new', received);
    socket.on('message:ack', received);
    socket.on('conversation:updated', updated);
    socket.on('message:unread-count', count);
    socket.on('connect_error', authError);
    if (!socket.connected) socket.connect();
    return () => {
      socket.off('connect', refresh);
      socket.off('message:new', received);
      socket.off('message:ack', received);
      socket.off('conversation:updated', updated);
      socket.off('message:unread-count', count);
      socket.off('connect_error', authError);
      socket.disconnect();
    };
  }, [client, userId]);
}
export function useOnlinePresence(targetId: string, enabled = true) {
  const [online, setOnline] = useState(false);
  useEffect(() => {
    if (!targetId || !enabled) return;
    const socket = messagingSocket();
    const subscribe = () => {
      socket.emit('presence:subscribe', { userId: targetId }, (result) => {
        if (result.ok) setOnline(result.data.online);
        else setOnline(false);
      });
    };
    const changed = (payload: { userId: string; online: boolean }) => {
      if (payload.userId === targetId) setOnline(payload.online);
    };
    socket.on('connect', subscribe);
    socket.on('presence:changed', changed);
    if (socket.connected) subscribe();
    return () => {
      socket.off('connect', subscribe);
      socket.off('presence:changed', changed);
      if (socket.connected) socket.emit('presence:unsubscribe', { userId: targetId }, () => undefined);
      setOnline(false);
    };
  }, [targetId, enabled]);
  return online;
}
export function useTypingIndicator(conversationId: string) {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    if (!conversationId) return;
    const socket = messagingSocket();
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const started = (payload: { conversationId: string }) => {
      if (payload.conversationId !== conversationId) return;
      setTyping(true);
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => setTyping(false), 5_000);
    };
    const stopped = (payload: { conversationId: string }) => {
      if (payload.conversationId === conversationId) {
        if (timeout) clearTimeout(timeout);
        setTyping(false);
      }
    };
    socket.on('typing:started', started);
    socket.on('typing:stopped', stopped);
    return () => {
      socket.off('typing:started', started);
      socket.off('typing:stopped', stopped);
      if (timeout) clearTimeout(timeout);
    };
  }, [conversationId]);
  return typing;
}
export function useReadReceipt(conversationId: string) {
  const client = useQueryClient();
  useEffect(() => {
    const socket = messagingSocket();
    const read = (payload: { conversationId: string }) => {
      if (payload.conversationId === conversationId)
        void client.invalidateQueries({ queryKey: messageKeys.conversation(conversationId) });
    };
    socket.on('message:read', read);
    return () => {
      socket.off('message:read', read);
    };
  }, [conversationId, client]);
}
export type { ConversationDto, ConversationPage };
