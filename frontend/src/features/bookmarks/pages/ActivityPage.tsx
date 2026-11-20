import { ACTIVITY_TYPES, type ActivityType } from '@voklance/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { apiErrorMessage } from '@/lib/apiClient';
import { bookmarkApi } from '../api/bookmarkApi';

export default function ActivityPage() {
  const [type, setType] = useState<ActivityType | ''>('');
  const activity = useInfiniteQuery({
    queryKey: ['personal-activity', type],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => bookmarkApi.activity({ type: type || undefined, cursor: pageParam }),
    getNextPageParam: (page) => page.nextCursor ?? undefined
  });
  const items = activity.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <div className="community-page">
      <header className="community-panel">
        <Link className="community-back" to="/app/saved">
          Back to saved items
        </Link>
        <h1>Your activity</h1>
        <p>
          A private timeline based on your current posts, comments, reactions, connections, communities,
          events, resources, and referrals.
        </p>
      </header>
      <section className="community-panel">
        <label htmlFor="activity-type">Show activity</label>
        <select
          id="activity-type"
          value={type}
          onChange={(event) => setType(event.target.value as ActivityType | '')}
        >
          <option value="">All activity</option>
          {ACTIVITY_TYPES.map((value) => (
            <option key={value} value={value}>
              {value.charAt(0).toUpperCase() + value.slice(1)}
            </option>
          ))}
        </select>
        {activity.isPending ? (
          <p role="status">Loading activity…</p>
        ) : activity.isError ? (
          <div role="alert">
            <p>{apiErrorMessage(activity.error)}</p>
            <button type="button" onClick={() => void activity.refetch()}>
              Try again
            </button>
          </div>
        ) : !items.length ? (
          <p>No activity found.</p>
        ) : (
          <ol className="activity-timeline">
            {items.map((item) => (
              <li key={item.id}>
                <span className="command-activity-type">{item.type}</span>
                <p>{item.href ? <Link to={item.href}>{item.title}</Link> : item.title}</p>
                <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
              </li>
            ))}
          </ol>
        )}
        {activity.hasNextPage && (
          <button
            type="button"
            className="community-action"
            disabled={activity.isFetchingNextPage}
            onClick={() => void activity.fetchNextPage()}
          >
            Load more
          </button>
        )}
      </section>
    </div>
  );
}
