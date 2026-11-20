import type { ProfessionalEventDTO } from '@voklance/shared';
import { Link } from 'react-router';
import { displayEventTime } from '../utils/zonedDateTime';

export default function EventCard({ event }: { event: ProfessionalEventDTO }) {
  return (
    <article className="community-panel event-card">
      <div className="event-card-top">
        <span className="command-activity-type">{event.type === 'event' ? 'Event' : 'Meetup'}</span>
        <span role="status">{event.status}</span>
      </div>
      <h3>
        <Link to={`/app/events/${event.id}`}>{event.title}</Link>
      </h3>
      <p>
        {event.community.name} · {event.organizer.name}
      </p>
      <time dateTime={event.startAt}>{displayEventTime(event.startAt, event.timezone)}</time>
      <p>{event.locationType === 'online' ? 'Online' : event.venueName || 'Venue to be announced'}</p>
      <p>
        {event.confirmedCount}
        {event.capacity ? ` / ${event.capacity}` : ''} {event.type === 'event' ? 'registered' : 'going'}
      </p>
      {event.myRegistration === 'registered' && <span role="status">Registered</span>}
      {event.myRSVP && <span role="status">RSVP: {event.myRSVP.replace('_', ' ')}</span>}
    </article>
  );
}
