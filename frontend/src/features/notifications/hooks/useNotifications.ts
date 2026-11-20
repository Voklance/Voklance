import type { NotificationCategory, NotificationDto, NotificationPage } from '@voklance/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { currentConversation, messagingSocket } from '@/lib/socketClient';
import { notificationApi } from '../api/notificationApi';
export const notificationKeys = {
  root: ['notifications'] as const,
  list: (category?: NotificationCategory, unreadOnly = false) =>
    ['notifications', 'list', category ?? 'all', unreadOnly] as const,
  unread: ['notifications', 'unread'] as const,
  preferences: ['notifications', 'preferences'] as const
};
export function useNotificationList(category?: NotificationCategory, unreadOnly = false) {
  return useInfiniteQuery({
    queryKey: notificationKeys.list(category, unreadOnly),
    queryFn: ({ pageParam }) => notificationApi.list(category, unreadOnly, pageParam),
    initialPageParam: '' as string,
    getNextPageParam: (page: NotificationPage) => (page.hasMore ? (page.nextCursor ?? undefined) : undefined)
  });
}
export function useNotificationCount() {
  return useQuery({ queryKey: notificationKeys.unread, queryFn: notificationApi.unread, staleTime: 30_000 });
}
export function useNotificationPreferences() {
  return useQuery({ queryKey: notificationKeys.preferences, queryFn: notificationApi.preferences });
}
export function useNotificationMutations() {
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: notificationKeys.root });
  };
  return {
    read: useMutation({ mutationFn: notificationApi.read, onSuccess: refresh }),
    readAll: useMutation({ mutationFn: notificationApi.readAll, onSuccess: refresh }),
    preferences: useMutation({ mutationFn: notificationApi.savePreferences, onSuccess: refresh })
  };
}
export function useNotificationRealtime(userId: string) {
  const client = useQueryClient();
  const [notice, setNotice] = useState<NotificationDto | null>(null);
  useEffect(() => {
    const socket = messagingSocket();
    const refresh = () => {
      void client.invalidateQueries({ queryKey: notificationKeys.root });
    };
    const created = (item: NotificationDto) => {
      refresh();
      if (item.type !== 'MESSAGE_RECEIVED' || item.entityId !== currentConversation())
        setNotice((old) => (old?.id === item.id ? old : item));
    };
    const count = (value: { unreadCount: number }) => client.setQueryData(notificationKeys.unread, value);
    socket.on('connect', refresh);
    socket.on('notification:new', created);
    socket.on('notification:updated', refresh);
    socket.on('notification:unread-count', count);
    return () => {
      socket.off('connect', refresh);
      socket.off('notification:new', created);
      socket.off('notification:updated', refresh);
      socket.off('notification:unread-count', count);
    };
  }, [client, userId]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5_000);
    return () => clearTimeout(timer);
  }, [notice]);
  return { notice, dismiss: () => setNotice(null) };
}
