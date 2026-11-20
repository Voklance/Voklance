import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { apiErrorMessage } from '@/lib/apiClient';
import NotificationCard from './NotificationCard';
import {
  useNotificationCount,
  useNotificationList,
  useNotificationMutations
} from '../hooks/useNotifications';
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const count = useNotificationCount();
  const list = useNotificationList();
  const { readAll } = useNotificationMutations();
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const outside = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', close);
    document.addEventListener('mousedown', outside);
    return () => {
      document.removeEventListener('keydown', close);
      document.removeEventListener('mousedown', outside);
    };
  }, [open]);
  const items = list.data?.pages.flatMap((page) => page.items).slice(0, 5) ?? [];
  return (
    <div className="notification-bell" ref={root}>
      <button
        className="top-control notification-control"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Notifications${count.data?.unreadCount ? `, ${count.data.unreadCount} unread` : ''}`}
        onClick={() => setOpen(!open)}
      >
        Notifications{' '}
        {count.data?.unreadCount ? (
          <span className="notification-badge">{count.data.unreadCount}</span>
        ) : null}
      </button>
      {open && (
        <section className="notification-dropdown" role="dialog" aria-label="Notifications">
          <header>
            <h2>Notifications</h2>
            <button
              type="button"
              onClick={() => readAll.mutate(undefined)}
              disabled={readAll.isPending || !count.data?.unreadCount}
            >
              Mark all read
            </button>
          </header>
          {list.isPending ? (
            <p role="status">Loading notifications…</p>
          ) : list.isError ? (
            <p role="alert">{apiErrorMessage(list.error)}</p>
          ) : items.length ? (
            <div className="notification-list">
              {items.map((item) => (
                <NotificationCard key={item.id} item={item} onOpen={() => setOpen(false)} />
              ))}
            </div>
          ) : (
            <p className="notification-empty">No notifications yet.</p>
          )}
          <Link to="/app/notifications" onClick={() => setOpen(false)}>
            View all notifications
          </Link>
        </section>
      )}
    </div>
  );
}
