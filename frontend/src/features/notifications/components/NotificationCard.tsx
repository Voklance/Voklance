import type { NotificationDto } from '@voklance/shared';
import { useNavigate } from 'react-router';
import { useNotificationMutations } from '../hooks/useNotifications';
export function notificationTarget(item: NotificationDto) {
  switch (item.entityType) {
    case 'connection_request':
      return '/app/network';
    case 'referral':
      return '/app/community-chat';
    case 'event':
      return `/app/events/${item.entityId}`;
    case 'community':
      return '/app/communities';
    case 'resource':
      return `/app/resources/${item.entityId}`;
    case 'post':
      return '/app';
    case 'conversation':
      return `/app/messages/${item.entityId}`;
  }
}
export default function NotificationCard({ item, onOpen }: { item: NotificationDto; onOpen?: () => void }) {
  const navigate = useNavigate();
  const { read } = useNotificationMutations();
  const open = () => {
    if (!item.readAt) read.mutate(item.id);
    onOpen?.();
    navigate(notificationTarget(item));
  };
  return (
    <article className={`notification-card${item.readAt ? '' : ' unread'}`}>
      <button type="button" className="notification-open" onClick={open}>
        <strong>{item.title}</strong>
        <span>{item.body}</span>
        <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
      </button>
      {!item.readAt && (
        <button
          type="button"
          className="notification-mark"
          onClick={() => read.mutate(item.id)}
          disabled={read.isPending}
        >
          Mark read
        </button>
      )}
    </article>
  );
}
