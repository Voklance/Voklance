import { NOTIFICATION_CATEGORIES, type NotificationCategory } from '@voklance/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { apiErrorMessage } from '@/lib/apiClient';
import NotificationCard from '../components/NotificationCard';
import { useNotificationList, useNotificationMutations } from '../hooks/useNotifications';
export default function NotificationsPage() {
  const [category, setCategory] = useState<NotificationCategory | undefined>();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const list = useNotificationList(category, unreadOnly);
  const { readAll } = useNotificationMutations();
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <section className="notifications-page">
      <header>
        <div>
          <p className="network-eyebrow">Your activity</p>
          <h1>Notifications</h1>
        </div>
        <div>
          <Link to="/app/notifications/settings">Preferences</Link>{' '}
          <button type="button" onClick={() => readAll.mutate(category)} disabled={readAll.isPending}>
            Mark all read
          </button>
        </div>
      </header>
      <div className="notification-filters">
        <label>
          Category
          <select
            value={category ?? 'all'}
            onChange={(event) =>
              setCategory(
                event.target.value === 'all' ? undefined : (event.target.value as NotificationCategory)
              )
            }
          >
            <option value="all">All</option>
            {NOTIFICATION_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {value[0].toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(event) => setUnreadOnly(event.target.checked)}
          />{' '}
          Unread only
        </label>
      </div>
      {list.isPending ? (
        <p role="status">Loading notifications…</p>
      ) : list.isError ? (
        <p role="alert">
          {apiErrorMessage(list.error)}{' '}
          <button type="button" onClick={() => void list.refetch()}>
            Retry
          </button>
        </p>
      ) : items.length ? (
        <div className="notification-list">
          {items.map((item) => (
            <NotificationCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <p className="notification-empty">No notifications in this view.</p>
      )}
      {list.hasNextPage && (
        <button
          type="button"
          className="message-load"
          disabled={list.isFetchingNextPage}
          onClick={() => void list.fetchNextPage()}
        >
          Load more
        </button>
      )}
    </section>
  );
}
