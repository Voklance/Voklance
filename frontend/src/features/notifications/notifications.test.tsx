// @vitest-environment jsdom
import type { NotificationDto } from '@voklance/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notificationApi } from './api/notificationApi';
import NotificationBell from './components/NotificationBell';
import { useNotificationRealtime } from './hooks/useNotifications';
import NotificationsPage from './pages/NotificationsPage';
import NotificationSettingsPage from './pages/NotificationSettingsPage';
const fakeSocket = vi.hoisted(() => {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  return {
    on: vi.fn((event: string, listener: (payload: unknown) => void) => {
      const set = listeners.get(event) ?? new Set();
      set.add(listener);
      listeners.set(event, set);
    }),
    off: vi.fn((event: string, listener: (payload: unknown) => void) => {
      listeners.get(event)?.delete(listener);
    }),
    trigger(event: string, payload: unknown) {
      for (const listener of listeners.get(event) ?? []) listener(payload);
    },
    reset() {
      listeners.clear();
    }
  };
});
vi.mock('@/lib/socketClient', () => ({ messagingSocket: () => fakeSocket, currentConversation: () => null }));
vi.mock('./api/notificationApi', () => ({
  notificationApi: {
    list: vi.fn(),
    unread: vi.fn(),
    read: vi.fn(),
    readAll: vi.fn(),
    preferences: vi.fn(),
    savePreferences: vi.fn()
  }
}));
const item: NotificationDto = {
  id: 'a'.repeat(24),
  type: 'CONNECTION_REQUEST_RECEIVED',
  category: 'network',
  title: 'Connection request',
  body: 'A professional sent you a connection request.',
  actorId: 'b'.repeat(24),
  entityType: 'connection_request',
  entityId: 'c'.repeat(24),
  readAt: null,
  createdAt: new Date().toISOString()
};
function Realtime() {
  const { notice } = useNotificationRealtime('u');
  return <p>{notice?.title}</p>;
}
function show(path = '/app/notifications') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <NotificationBell />
        <Realtime />
        <Routes>
          <Route path="/app/notifications" element={<NotificationsPage />} />
          <Route path="/app/notifications/settings" element={<NotificationSettingsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return client;
}
beforeEach(() => {
  vi.clearAllMocks();
  fakeSocket.reset();
  vi.mocked(notificationApi.list).mockResolvedValue({ items: [item], hasMore: false, nextCursor: null });
  vi.mocked(notificationApi.unread).mockResolvedValue({ unreadCount: 1 });
  vi.mocked(notificationApi.read).mockResolvedValue({
    notification: { ...item, readAt: new Date().toISOString() }
  });
  vi.mocked(notificationApi.readAll).mockResolvedValue({ affectedCount: 1, unreadCount: 0 });
  vi.mocked(notificationApi.preferences).mockResolvedValue({
    preferences: {
      network: true,
      referrals: true,
      events: true,
      communities: true,
      resources: true,
      feed: true,
      messages: true
    }
  });
  vi.mocked(notificationApi.savePreferences).mockResolvedValue({
    preferences: {
      network: false,
      referrals: true,
      events: true,
      communities: true,
      resources: true,
      feed: true,
      messages: true
    }
  });
});
afterEach(cleanup);
describe('notification center', () => {
  it('opens recent notifications, marks one read, and offers mark all', async () => {
    show();
    fireEvent.click(await screen.findByRole('button', { name: /Notifications, 1 unread/ }));
    expect(screen.getByRole('dialog', { name: 'Notifications' })).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Mark read' })[0]);
    await waitFor(() => expect(notificationApi.read).toHaveBeenCalledWith(item.id, expect.any(Object)));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Notifications' })).getByRole('button', {
        name: 'Mark all read'
      })
    );
    await waitFor(() => expect(notificationApi.readAll).toHaveBeenCalled());
  });
  it('filters, receives socket updates, and saves preferences', async () => {
    show();
    expect(await screen.findByRole('heading', { name: 'Notifications', level: 1 })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'network' } });
    await waitFor(() => expect(notificationApi.list).toHaveBeenCalledWith('network', false, ''));
    act(() => fakeSocket.trigger('notification:new', { ...item, id: 'd'.repeat(24) }));
    expect(screen.getByText('Connection request', { selector: 'p' })).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Preferences' }));
    expect(await screen.findByRole('heading', { name: 'Notification preferences' })).toBeTruthy();
    fireEvent.click(await screen.findByLabelText('Network'));
    fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }));
    await waitFor(() =>
      expect(notificationApi.savePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ network: false }),
        expect.any(Object)
      )
    );
  });
});
