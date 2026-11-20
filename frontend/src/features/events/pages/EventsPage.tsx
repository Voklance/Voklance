import { useState } from 'react';
import EventCard from '../components/EventCard';
import { useEvents } from '../hooks/useEvents';
import { apiErrorMessage } from '@/lib/apiClient';

const tabs = [
  { id: 'upcoming', label: 'Upcoming events', filters: { upcoming: true } },
  {
    id: 'registrations',
    label: 'My registrations and RSVPs',
    filters: { upcoming: true, mine: 'participating' as const }
  },
  {
    id: 'meetups',
    label: 'My meetups',
    filters: { upcoming: true, mine: 'participating' as const, type: 'meetup' as const }
  },
  { id: 'organized', label: 'Events I organized', filters: { upcoming: true, mine: 'organized' as const } },
  { id: 'past', label: 'Past events', filters: { upcoming: false } }
] as const;
export default function EventsPage() {
  const [tab, setTab] = useState<(typeof tabs)[number]['id']>('upcoming');
  const selected = tabs.find((item) => item.id === tab)!;
  const query = useEvents(selected.filters);
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <div className="community-page event-page">
      <header>
        <h1>Professional events</h1>
        <p>Discover sessions and meetups from professional communities.</p>
      </header>
      <div className="event-tabs" role="tablist" aria-label="Event views">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? 'community-primary' : 'community-action'}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <section aria-live="polite">
        <h2>{selected.label}</h2>
        {query.isPending ? (
          <p role="status">Loading events…</p>
        ) : query.isError ? (
          <div role="alert">
            <p>{apiErrorMessage(query.error)}</p>
            <button type="button" onClick={() => void query.refetch()}>
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <p>No events in this view yet.</p>
        ) : (
          <div className="event-grid">
            {items.map((item) => (
              <EventCard key={item.id} event={item} />
            ))}
          </div>
        )}
        {query.hasNextPage && (
          <button
            type="button"
            className="community-action"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        )}
      </section>
    </div>
  );
}
