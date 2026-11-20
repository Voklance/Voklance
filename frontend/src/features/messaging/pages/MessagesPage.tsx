import type { ConversationDto, MessageDto, MessagingPrivacySettings } from '@voklance/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { apiErrorMessage } from '@/lib/apiClient';
import { useFlash } from '@/components/shared/FlashMessages';
import { messagingSocket, setActiveConversation } from '@/lib/socketClient';
import MessageComposer from '../components/MessageComposer';
import MessageHistory from '../components/MessageHistory';
import type { PendingMessage } from '../components/MessageBubble';
import MessageReportDialog from '../components/MessageReportDialog';
import { messagingApi } from '../api/messagingApi';
import {
  appendMessageToCache,
  messageKeys,
  useConversation,
  useConversations,
  useMessages,
  useMessagingSettings,
  useOnlinePresence,
  useReadReceipt,
  useTypingIndicator,
  useUnreadMessageCount
} from '../hooks/useMessaging';

function PrivacyPanel() {
  const query = useMessagingSettings();
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: messagingApi.saveSettings,
    onSuccess: () => void client.invalidateQueries({ queryKey: messageKeys.settings })
  });
  const [draft, setDraft] = useState<MessagingPrivacySettings | null>(null);
  useEffect(() => {
    if (query.data?.settings && draft === null) setDraft(query.data.settings);
  }, [query.data, draft]);
  if (query.isError) return <p role="alert">Could not load messaging settings.</p>;
  if (!draft) return <p role="status">Loading messaging settings…</p>;
  return (
    <form
      className="message-settings"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(draft);
      }}
    >
      <h2>Messaging privacy</h2>
      <label>
        <input
          type="checkbox"
          checked={draft.allowDirectMessages}
          onChange={(event) => setDraft({ ...draft, allowDirectMessages: event.target.checked })}
        />{' '}
        Allow direct messages from my connections
      </label>
      <label>
        <input
          type="checkbox"
          checked={draft.showReadReceipts}
          onChange={(event) => setDraft({ ...draft, showReadReceipts: event.target.checked })}
        />{' '}
        Show when I have read messages
      </label>
      <label>
        <input
          type="checkbox"
          checked={draft.showOnlineStatus}
          onChange={(event) => setDraft({ ...draft, showOnlineStatus: event.target.checked })}
        />{' '}
        Show my online status to connections
      </label>
      <button type="submit" className="community-primary" disabled={save.isPending}>
        {save.isPending ? 'Saving…' : 'Save settings'}
      </button>
      {save.isSuccess && <p role="status">Settings saved.</p>}
      {save.isError && <p role="alert">{apiErrorMessage(save.error)}</p>}
    </form>
  );
}

function ConversationRow({
  conversation,
  selected,
  online
}: {
  conversation: ConversationDto;
  selected: boolean;
  online: boolean;
}) {
  return (
    <Link
      className={`message-conversation-row ${selected ? 'selected' : ''}`}
      to={`/app/messages/${conversation.id}`}
      aria-current={selected ? 'page' : undefined}
    >
      <span className="network-avatar" aria-hidden="true">
        {conversation.person.name.charAt(0).toUpperCase()}
      </span>
      <span className="message-conversation-copy">
        <strong>{conversation.person.name}</strong>
        <small>{conversation.person.headline ?? 'Professional connection'}</small>
        <span>{conversation.lastMessage?.body ?? 'Start the conversation'}</span>
      </span>
      <span className="message-conversation-meta">
        {conversation.lastMessageAt && (
          <time dateTime={conversation.lastMessageAt}>
            {new Date(conversation.lastMessageAt).toLocaleDateString()}
          </time>
        )}
        {conversation.unreadCount > 0 && (
          <b aria-label={`${conversation.unreadCount} unread messages`}>{conversation.unreadCount}</b>
        )}
        {selected && <small>{online ? 'Online' : 'Offline'}</small>}
      </span>
    </Link>
  );
}

export default function MessagesPage() {
  const { conversationId = '' } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const account = useCurrentUser();
  const { showFlash } = useFlash();
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const [reportTarget, setReportTarget] = useState<MessageDto | null>(null);
  const [blockedTargetId, setBlockedTargetId] = useState<string | null>(null);
  const conversations = useConversations(search);
  const unread = useUnreadMessageCount();
  const detail = useConversation(conversationId);
  const history = useMessages(conversationId);
  const typing = useTypingIndicator(conversationId);
  const online = useOnlinePresence(
    detail.data?.conversation.person.userId ?? '',
    !!conversationId && !detail.isError
  );
  useReadReceipt(conversationId);
  const mute = useMutation({
    mutationFn: () =>
      messagingApi.preferences(conversationId, { muted: !detail.data?.conversation.preferences.muted }),
    onSuccess: () => void client.invalidateQueries({ queryKey: messageKeys.conversation(conversationId) })
  });
  const archive = useMutation({
    mutationFn: () => messagingApi.preferences(conversationId, { archived: true }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['messages', 'conversations'] });
      navigate('/app/messages');
    }
  });
  const block = useMutation({
    mutationFn: messagingApi.block,
    onSuccess: (_result, targetId) => {
      setBlockedTargetId(targetId);
      void client.invalidateQueries({ queryKey: messageKeys.root });
    }
  });
  const unblock = useMutation({
    mutationFn: messagingApi.unblock,
    onSuccess: () => {
      setBlockedTargetId(null);
      void client.invalidateQueries({ queryKey: messageKeys.root });
    }
  });
  const messages =
    history.data?.pages
      .slice()
      .reverse()
      .flatMap((page) => page.items) ?? [];
  const list = [
    ...new Map(
      conversations.data?.pages.flatMap((page) => page.items).map((item) => [item.id, item]) ?? []
    ).values()
  ];

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchDraft.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchDraft]);
  useEffect(() => {
    setPending([]);
    setBlockedTargetId(null);
    setActiveConversation(conversationId || null);
    if (!conversationId) return () => setActiveConversation(null);
    const socket = messagingSocket();
    const join = () => socket.emit('conversation:join', { conversationId }, () => undefined);
    socket.on('connect', join);
    if (socket.connected) join();
    return () => {
      socket.off('connect', join);
      if (socket.connected) socket.emit('conversation:leave', { conversationId }, () => undefined);
      setActiveConversation(null);
    };
  }, [conversationId]);

  const sendPending = useCallback(
    async (item: PendingMessage) => {
      if (!conversationId) return;
      setPending((items) =>
        items.map((current) =>
          current.clientMessageId === item.clientMessageId ? { ...current, state: 'pending' } : current
        )
      );
      try {
        const socket = messagingSocket();
        let message: MessageDto;
        if (socket.connected) {
          const result = await socket.timeout(8_000).emitWithAck('message:send', {
            conversationId,
            clientMessageId: item.clientMessageId,
            body: item.body
          });
          if (!result.ok) throw new Error(result.message);
          message = result.data.message;
        } else message = (await messagingApi.send(conversationId, item.body, item.clientMessageId)).message;
        appendMessageToCache(client, message);
        setPending((items) => items.filter((current) => current.clientMessageId !== item.clientMessageId));
        void client.invalidateQueries({ queryKey: ['messages', 'conversations'] });
        showFlash({ type: 'success', message: 'Your message has been sent successfully.' });
      } catch {
        setPending((items) =>
          items.map((current) =>
            current.clientMessageId === item.clientMessageId ? { ...current, state: 'failed' } : current
          )
        );
        showFlash({ type: 'error', message: 'Message not sent. You can retry it in the conversation.' });
      }
    },
    [client, conversationId, showFlash]
  );
  const send = (body: string) => {
    const item: PendingMessage = { clientMessageId: crypto.randomUUID(), body, state: 'pending' };
    setPending((items) => [...items, item]);
    void sendPending(item);
  };
  const retry = (id: string) => {
    const item = pendingRef.current.find((value) => value.clientMessageId === id);
    if (item) void sendPending(item);
  };
  useEffect(() => {
    const socket = messagingSocket();
    const reconnect = () => {
      for (const item of pendingRef.current.filter((value) => value.state === 'pending'))
        void sendPending(item);
    };
    socket.on('connect', reconnect);
    return () => {
      socket.off('connect', reconnect);
    };
  }, [sendPending]);
  const marked = useRef<string | null>(null);
  const markVisible = useCallback(
    (message: MessageDto) => {
      if (!conversationId || document.visibilityState !== 'visible' || marked.current === message.id) return;
      marked.current = message.id;
      const refresh = () => {
        void client.invalidateQueries({ queryKey: messageKeys.unread });
        void client.invalidateQueries({ queryKey: messageKeys.conversation(conversationId) });
      };
      const socket = messagingSocket();
      if (socket.connected)
        socket.emit('message:read', { conversationId, messageId: message.id }, (result) => {
          if (result.ok) refresh();
          else marked.current = null;
        });
      else
        void messagingApi
          .read(conversationId, message.id)
          .then(refresh)
          .catch(() => {
            marked.current = null;
          });
    },
    [conversationId, client]
  );
  const searchSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSearch(searchDraft.trim());
  };
  return (
    <div className={`message-page ${conversationId ? 'has-conversation' : ''}`}>
      <aside className="message-inbox" aria-label="Conversations">
        <header>
          <div>
            <p className="network-eyebrow">Private conversations</p>
            <h1>Messages</h1>
            <p>{unread.data?.count ?? '—'} unread</p>
          </div>
          <button
            type="button"
            className="community-action"
            aria-expanded={showSettings}
            onClick={() => setShowSettings(!showSettings)}
          >
            Settings
          </button>
        </header>
        {showSettings && <PrivacyPanel />}
        <form role="search" onSubmit={searchSubmit}>
          <label>
            Search conversations
            <input
              type="search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Name or headline"
            />
          </label>
        </form>
        {conversations.isPending ? (
          <p role="status">Loading conversations…</p>
        ) : conversations.isError ? (
          <p role="alert">
            Could not load conversations.{' '}
            <button type="button" onClick={() => void conversations.refetch()}>
              Retry
            </button>
          </p>
        ) : list.length === 0 ? (
          <p className="message-empty">
            No conversations yet. Start one from a connected professional's profile.
          </p>
        ) : (
          <>
            <nav aria-label="Conversation list">
              {list.map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  selected={conversation.id === conversationId}
                  online={conversation.id === conversationId && online}
                />
              ))}
            </nav>
            {conversations.hasNextPage && (
              <button
                type="button"
                className="message-load"
                disabled={conversations.isFetchingNextPage}
                onClick={() => void conversations.fetchNextPage()}
              >
                Load more conversations
              </button>
            )}
          </>
        )}
      </aside>
      <section className="message-thread" aria-label="Selected conversation">
        {!conversationId ? (
          <div className="message-select">
            <h2>Select a conversation</h2>
            <p>Private messages are available to your professional connections.</p>
            <Link to="/app/network">My Network</Link>
          </div>
        ) : blockedTargetId ? (
          <div className="message-select">
            <Link to="/app/messages">Back to inbox</Link>
            <h2>Conversation blocked</h2>
            <button
              type="button"
              className="community-action"
              disabled={unblock.isPending}
              onClick={() => unblock.mutate(blockedTargetId)}
            >
              Unblock
            </button>
          </div>
        ) : detail.isPending || history.isPending ? (
          <p role="status" className="message-select">
            Loading messages…
          </p>
        ) : detail.isError || history.isError ? (
          <div role="alert" className="message-select">
            <Link to="/app/messages">Back to inbox</Link>
            <p>This conversation is unavailable.</p>
            <button
              type="button"
              onClick={() => {
                void detail.refetch();
                void history.refetch();
              }}
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <header className="message-thread-header">
              <Link className="message-back" to="/app/messages">
                Back
              </Link>
              <div>
                <h2>{detail.data.conversation.person.name}</h2>
                <p>
                  {detail.data.conversation.person.headline ?? 'Professional connection'} ·{' '}
                  {online ? 'Online' : 'Offline'}
                </p>
              </div>
              <div className="message-thread-actions">
                <button type="button" onClick={() => mute.mutate()} disabled={mute.isPending}>
                  {detail.data.conversation.preferences.muted ? 'Unmute' : 'Mute'}
                </button>
                <button type="button" onClick={() => archive.mutate()} disabled={archive.isPending}>
                  Archive
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        'Block this professional? You will no longer be able to message each other.'
                      )
                    )
                      block.mutate(detail.data.conversation.person.userId);
                  }}
                  disabled={block.isPending}
                >
                  Block
                </button>
              </div>
            </header>
            {(mute.isError || archive.isError || block.isError || unblock.isError) && (
              <p role="alert">
                {apiErrorMessage(mute.error ?? archive.error ?? block.error ?? unblock.error)}
              </p>
            )}
            <MessageHistory
              key={conversationId}
              messages={messages}
              pending={pending}
              ownId={account.data?.id ?? ''}
              otherLastReadMessageId={detail.data.conversation.otherLastReadMessageId}
              hasMore={history.hasNextPage}
              loadingOlder={history.isFetchingNextPage}
              onLoadOlder={() => void history.fetchNextPage()}
              onRetry={retry}
              onReport={setReportTarget}
              onViewLatest={markVisible}
            />
            {typing && (
              <p className="message-typing" role="status">
                {detail.data.conversation.person.name} is typing…
              </p>
            )}
            <MessageComposer conversationId={conversationId} disabled={false} onSend={send} />
          </>
        )}
      </section>
      {reportTarget && <MessageReportDialog message={reportTarget} onClose={() => setReportTarget(null)} />}
    </div>
  );
}
