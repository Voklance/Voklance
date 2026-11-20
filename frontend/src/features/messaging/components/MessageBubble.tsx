import type { MessageDto } from '@voklance/shared';
export type PendingMessage = { clientMessageId: string; body: string; state: 'pending' | 'failed' };
export default function MessageBubble({
  message,
  pending,
  own,
  read,
  onRetry,
  onReport
}: {
  message?: MessageDto;
  pending?: PendingMessage;
  own: boolean;
  read: boolean;
  onRetry?: () => void;
  onReport?: () => void;
}) {
  const body = message?.body ?? pending?.body ?? '';
  const time = message?.createdAt
    ? new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '';
  return (
    <li className={`message-bubble ${own ? 'own' : 'other'}`}>
      <p>{body}</p>
      <div className="message-meta">
        <time dateTime={message?.createdAt}>{time}</time>
        <span
          aria-label={
            pending?.state === 'pending'
              ? 'Pending'
              : pending?.state === 'failed'
                ? 'Failed'
                : read
                  ? 'Read'
                  : 'Saved'
          }
        >
          {pending?.state === 'pending'
            ? 'Pending'
            : pending?.state === 'failed'
              ? 'Failed'
              : read
                ? 'Read'
                : own
                  ? 'Saved'
                  : ''}
        </span>
      </div>
      {pending?.state === 'failed' && onRetry && (
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      )}
      {message && !own && onReport && (
        <button type="button" className="message-subtle" onClick={onReport}>
          Report
        </button>
      )}
    </li>
  );
}
