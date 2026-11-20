import { Link } from 'react-router';
import EventCard from './EventCard';
import { useCommunityEvents } from '../hooks/useEvents';

export default function CommunityEventsBoard({ communityId }: { communityId: string }) {
  const query = useCommunityEvents(communityId);
  return (
    <section className="community-panel" aria-labelledby="community-events-heading">
      <div className="event-board-heading">
        <h2 id="community-events-heading">Upcoming events and meetups</h2>
        <Link to="/app/events">Explore all</Link>
      </div>
      {query.isPending ? (
        <p role="status">Loading gatherings…</p>
      ) : query.isError ? (
        <p role="alert">
          Gatherings could not be loaded.{' '}
          <button type="button" onClick={() => void query.refetch()}>
            Try again
          </button>
        </p>
      ) : query.data.items.length ? (
        <div className="event-grid">
          {query.data.items.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <p>No upcoming gatherings yet.</p>
      )}
    </section>
  );
}
