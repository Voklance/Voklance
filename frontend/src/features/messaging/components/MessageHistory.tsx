import type { MessageDto } from '@voklance/shared';
import { useCallback, useLayoutEffect, useRef } from 'react';
import MessageBubble, { type PendingMessage } from './MessageBubble';
export default function MessageHistory({
  messages,
  pending,
  ownId,
  otherLastReadMessageId,
  hasMore,
  loadingOlder,
  onLoadOlder,
  onRetry,
  onReport,
  onViewLatest
}: {
  messages: MessageDto[];
  pending: PendingMessage[];
  ownId: string;
  otherLastReadMessageId: string | null;
  hasMore: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  onRetry: (id: string) => void;
  onReport: (message: MessageDto) => void;
  onViewLatest: (message: MessageDto) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const prior = useRef<{ height: number; top: number; count: number } | null>(null);
  const initialized = useRef(false);
  const lastId = messages.at(-1)?.id ?? '';
  const latestIncoming = [...messages].reverse().find((message) => message.senderId !== ownId);
  const viewLatest = useCallback(() => {
    const node = listRef.current;
    if (
      node &&
      latestIncoming &&
      document.visibilityState === 'visible' &&
      node.scrollHeight - node.scrollTop - node.clientHeight <= 64
    )
      onViewLatest(latestIncoming);
  }, [latestIncoming, onViewLatest]);
  useLayoutEffect(() => {
    const node = listRef.current;
    if (!node) return;
    if (!initialized.current) {
      node.scrollTop = node.scrollHeight;
      initialized.current = true;
    } else if (prior.current && messages.length > prior.current.count) {
      node.scrollTop = prior.current.top + node.scrollHeight - prior.current.height;
      prior.current = null;
    } else if (node.scrollHeight - node.scrollTop - node.clientHeight < 180)
      node.scrollTop = node.scrollHeight;
    viewLatest();
  }, [messages.length, lastId, pending.length, viewLatest]);
  useLayoutEffect(() => {
    document.addEventListener('visibilitychange', viewLatest);
    return () => document.removeEventListener('visibilitychange', viewLatest);
  }, [viewLatest]);
  const load = () => {
    const node = listRef.current;
    if (node) prior.current = { height: node.scrollHeight, top: node.scrollTop, count: messages.length };
    onLoadOlder();
  };
  return (
    <div className="message-history" ref={listRef} aria-label="Message history" onScroll={viewLatest}>
      {hasMore && (
        <button type="button" className="message-load" disabled={loadingOlder} onClick={load}>
          {loadingOlder ? 'Loading older messages…' : 'Load older messages'}
        </button>
      )}
      {messages.length === 0 && pending.length === 0 && (
        <p className="message-empty">No messages yet. Start the conversation.</p>
      )}
      <ol>
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            own={message.senderId === ownId}
            read={
              message.senderId === ownId && !!otherLastReadMessageId && message.id <= otherLastReadMessageId
            }
            onReport={() => onReport(message)}
          />
        ))}
        {pending
          .filter((item) => !messages.some((message) => message.clientMessageId === item.clientMessageId))
          .map((message) => (
            <MessageBubble
              key={message.clientMessageId}
              pending={message}
              own
              read={false}
              onRetry={() => onRetry(message.clientMessageId)}
            />
          ))}
      </ol>
    </div>
  );
}
