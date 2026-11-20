// @vitest-environment jsdom
import type { AuthUser, ConversationDto, MessageDto } from '@voklance/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { currentUserKey } from '@/features/auth/cache/authCache';
import { authApi } from '@/features/auth/api/authApi';
import { messagingApi } from '../api/messagingApi';
import { useMessagingLifecycle } from '../hooks/useMessaging';
import MessageHistory from '../components/MessageHistory';
import MessagesPage from './MessagesPage';

const fakeSocket = vi.hoisted(() => {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const socket = {
    connected: true,
    on: vi.fn((event: string, listener: (payload: unknown) => void) => {
      const set = listeners.get(event) ?? new Set();
      set.add(listener);
      listeners.set(event, set);
      return socket;
    }),
    off: vi.fn((event: string, listener: (payload: unknown) => void) => {
      listeners.get(event)?.delete(listener);
      return socket;
    }),
    emit: vi.fn((_event: string, _payload: unknown, ack: (result: unknown) => void) => {
      ack?.({ ok: true, data: { online: true } });
      return socket;
    }),
    connect: vi.fn(() => socket),
    disconnect: vi.fn(() => socket),
    sendReply: vi.fn(
      async (_event: string, payload: { conversationId: string; body: string; clientMessageId: string }) => ({
        ok: true,
        data: {
          message: {
            id: 'f'.repeat(24),
            conversationId: payload.conversationId,
            senderId: 'a'.repeat(24),
            body: payload.body,
            clientMessageId: payload.clientMessageId,
            createdAt: new Date().toISOString()
          }
        }
      })
    ),
    timeout: vi.fn(() => ({
      emitWithAck: (
        event: string,
        payload: { conversationId: string; body: string; clientMessageId: string }
      ) => socket.sendReply(event, payload)
    })),
    trigger(event: string, payload: unknown) {
      for (const listener of listeners.get(event) ?? []) listener(payload);
    },
    reset() {
      listeners.clear();
      socket.connected = true;
    }
  };
  return socket;
});
vi.mock('@/lib/socketClient', () => ({
  messagingSocket: () => fakeSocket,
  setActiveConversation: vi.fn(),
  currentConversation: () => null,
  disconnectMessagingSocket: vi.fn()
}));
vi.mock('@/features/auth/api/authApi', () => ({ authApi: { currentUser: vi.fn() } }));
vi.mock('../api/messagingApi', () => ({
  messagingApi: {
    conversations: vi.fn(),
    conversation: vi.fn(),
    messages: vi.fn(),
    unreadCount: vi.fn(),
    preferences: vi.fn(),
    block: vi.fn(),
    unblock: vi.fn(),
    report: vi.fn(),
    settings: vi.fn(),
    saveSettings: vi.fn(),
    send: vi.fn(),
    read: vi.fn()
  }
}));
const user: AuthUser = {
  id: 'a'.repeat(24),
  name: 'Ada',
  email: 'ada@example.test',
  accountStatus: 'ACTIVE',
  onboardingStatus: 'COMPLETED',
  emailVerifiedAt: null,
  emailVerificationRequired: false
};
const conversation: ConversationDto = {
  id: 'b'.repeat(24),
  person: { userId: 'c'.repeat(24), name: 'Sam Engineer', username: 'sam', headline: 'Backend Engineer' },
  lastMessage: null,
  lastMessageAt: null,
  unreadCount: 0,
  preferences: { muted: false, archived: false },
  otherLastReadMessageId: null,
  createdAt: new Date().toISOString()
};
const incoming: MessageDto = {
  id: 'd'.repeat(24),
  conversationId: conversation.id,
  senderId: conversation.person.userId,
  body: 'Hello Ada',
  clientMessageId: crypto.randomUUID(),
  createdAt: new Date().toISOString()
};
function Harness() {
  useMessagingLifecycle(user.id);
  return (
    <Routes>
      <Route path="/app/messages" element={<MessagesPage />} />
      <Route path="/app/messages/:conversationId" element={<MessagesPage />} />
    </Routes>
  );
}
function show(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  client.setQueryData(currentUserKey, user);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Harness />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return client;
}
beforeEach(() => {
  vi.clearAllMocks();
  fakeSocket.reset();
  vi.mocked(authApi.currentUser).mockResolvedValue(user);
  vi.mocked(messagingApi.conversations).mockResolvedValue({
    items: [conversation],
    hasMore: false,
    nextCursor: null
  });
  vi.mocked(messagingApi.conversation).mockResolvedValue({ conversation });
  vi.mocked(messagingApi.messages).mockResolvedValue({ items: [incoming], hasMore: false, nextCursor: null });
  vi.mocked(messagingApi.unreadCount).mockResolvedValue({ count: 1 });
  vi.mocked(messagingApi.read).mockResolvedValue({ messageId: incoming.id });
  vi.mocked(messagingApi.preferences).mockResolvedValue({ preferences: { muted: true, archived: false } });
  vi.mocked(messagingApi.block).mockResolvedValue({ blocked: true });
  vi.mocked(messagingApi.unblock).mockResolvedValue({ blocked: false });
  vi.mocked(messagingApi.report).mockResolvedValue({ reportId: 'e'.repeat(24) });
  vi.mocked(messagingApi.settings).mockResolvedValue({
    settings: { allowDirectMessages: true, showReadReceipts: false, showOnlineStatus: true }
  });
  vi.mocked(messagingApi.saveSettings).mockResolvedValue({
    settings: { allowDirectMessages: false, showReadReceipts: false, showOnlineStatus: true }
  });
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true)
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('messaging inbox', () => {
  it('marks the newest received message viewed only at the visible end of history', () => {
    const viewed = vi.fn();
    const props = {
      pending: [],
      ownId: user.id,
      otherLastReadMessageId: null,
      hasMore: false,
      loadingOlder: false,
      onLoadOlder: vi.fn(),
      onRetry: vi.fn(),
      onReport: vi.fn(),
      onViewLatest: viewed
    };
    const { rerender } = render(<MessageHistory {...props} messages={[incoming]} />);
    const history = screen.getByLabelText('Message history');
    Object.defineProperty(history, 'scrollHeight', { configurable: true, get: () => 500 });
    Object.defineProperty(history, 'clientHeight', { configurable: true, get: () => 100 });
    history.scrollTop = 0;
    viewed.mockClear();
    const newer = { ...incoming, id: 'e'.repeat(24), body: 'Newest' };
    rerender(<MessageHistory {...props} messages={[incoming, newer]} />);
    expect(viewed).not.toHaveBeenCalled();
    history.scrollTop = 400;
    fireEvent.scroll(history);
    expect(viewed).toHaveBeenCalledWith(newer);
  });
  it('renders conversations, search and responsive thread navigation', async () => {
    show('/app/messages');
    expect(await screen.findByRole('link', { name: /Sam Engineer/ })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search conversations'), { target: { value: 'Backend' } });
    await waitFor(() => expect(messagingApi.conversations).toHaveBeenCalledWith('Backend', ''));
    fireEvent.click(screen.getByRole('link', { name: /Sam Engineer/ }));
    expect(await screen.findByText('Hello Ada')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back' })).toBeTruthy();
  });
  it('shows pending, saved, failed and retry states with one bubble per client ID', async () => {
    let resolve: (value: Awaited<ReturnType<typeof fakeSocket.sendReply>>) => void = () => undefined;
    fakeSocket.sendReply.mockImplementationOnce(
      () =>
        new Promise<Awaited<ReturnType<typeof fakeSocket.sendReply>>>((done) => {
          resolve = done;
        })
    );
    show(`/app/messages/${conversation.id}`);
    await screen.findByText('Hello Ada');
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Hello Sam' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByText('Pending')).toBeTruthy();
    const sentPayload = fakeSocket.sendReply.mock.calls[0][1];
    resolve({
      ok: true,
      data: {
        message: {
          id: 'f'.repeat(24),
          conversationId: conversation.id,
          senderId: user.id,
          body: 'Hello Sam',
          clientMessageId: sentPayload.clientMessageId,
          createdAt: new Date().toISOString()
        }
      }
    });
    await waitFor(() => expect(screen.getAllByText('Hello Sam')).toHaveLength(1));
    fakeSocket.sendReply.mockRejectedValueOnce(new Error('offline'));
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Try later' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(fakeSocket.sendReply).toHaveBeenCalledTimes(3));
  });
  it('updates incoming messages and unread count from socket events', async () => {
    show(`/app/messages/${conversation.id}`);
    await screen.findByText('Hello Ada');
    fakeSocket.trigger('message:new', {
      ...incoming,
      id: 'e'.repeat(24),
      body: 'Another message',
      clientMessageId: crypto.randomUUID()
    });
    expect(await screen.findByText('Another message')).toBeTruthy();
    await waitFor(() => expect(messagingApi.unreadCount).toHaveBeenCalled());
    act(() => fakeSocket.trigger('message:unread-count', { count: 2 }));
    expect(await screen.findByText('2 unread')).toBeTruthy();
    act(() =>
      fakeSocket.trigger('typing:started', {
        conversationId: conversation.id,
        userId: conversation.person.userId
      })
    );
    expect(screen.getByText('Sam Engineer is typing…')).toBeTruthy();
    act(() =>
      fakeSocket.trigger('typing:stopped', {
        conversationId: conversation.id,
        userId: conversation.person.userId
      })
    );
    expect(screen.queryByText('Sam Engineer is typing…')).toBeNull();
    act(() => fakeSocket.trigger('presence:changed', { userId: conversation.person.userId, online: true }));
    expect(screen.getAllByText(/Online/).length).toBeGreaterThan(0);
  });
  it('mutes, blocks, reports and edits privacy settings', async () => {
    show(`/app/messages/${conversation.id}`);
    await screen.findByText('Hello Ada');
    fireEvent.click(screen.getByRole('button', { name: 'Mute' }));
    await waitFor(() =>
      expect(messagingApi.preferences).toHaveBeenCalledWith(conversation.id, { muted: true })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Report' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Report message' })).getByRole('button', { name: 'Report' })
    );
    await waitFor(() => expect(messagingApi.report).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Block' }));
    await waitFor(() =>
      expect(messagingApi.block).toHaveBeenCalledWith(conversation.person.userId, expect.any(Object))
    );
    fireEvent.click(screen.getByRole('button', { name: 'Unblock' }));
    await waitFor(() =>
      expect(messagingApi.unblock).toHaveBeenCalledWith(conversation.person.userId, expect.any(Object))
    );
    fireEvent.click(await screen.findByRole('link', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(await screen.findByRole('heading', { name: 'Messaging privacy' })).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Allow direct messages from my connections'));
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() =>
      expect(messagingApi.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ allowDirectMessages: false }),
        expect.any(Object)
      )
    );
  });
  it('shows loading, empty and error states', async () => {
    vi.mocked(messagingApi.conversations).mockImplementationOnce(() => new Promise(() => undefined));
    show('/app/messages');
    expect(screen.getByText('Loading conversations…')).toBeTruthy();
    cleanup();
    vi.mocked(messagingApi.conversations).mockResolvedValueOnce({
      items: [],
      hasMore: false,
      nextCursor: null
    });
    show('/app/messages');
    expect(await screen.findByText(/No conversations yet/)).toBeTruthy();
    cleanup();
    vi.mocked(messagingApi.conversations).mockRejectedValueOnce(new Error('offline'));
    show('/app/messages');
    expect(await screen.findByText(/Could not load conversations/)).toBeTruthy();
  });
});
