import { useState } from 'react';
import { Link, useParams } from 'react-router';
import type { RSVPResponse } from '@voklance/shared';
import LoadingState from '@/components/shared/LoadingState';
import ErrorState from '@/components/shared/ErrorState';
import { apiErrorMessage } from '@/lib/apiClient';
import { displayEventTime } from '../utils/zonedDateTime';
import { useAttendees, useEvent, useEventActions } from '../hooks/useEvents';
import BookmarkButton from '@/features/bookmarks/components/BookmarkButton';

function Attendees({ eventId }: { eventId: string }) {
  const query = useAttendees(eventId, true);
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <section className="community-panel">
      <h2>Attendees</h2>
      {query.isPending ? (
        <p role="status">Loading attendees…</p>
      ) : query.isError ? (
        <p role="alert">{apiErrorMessage(query.error)}</p>
      ) : items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item.userId}>
              {item.profile.username ? (
                <Link to={`/app/professionals/${item.profile.username}`}>{item.profile.name}</Link>
              ) : (
                item.profile.name
              )}{' '}
              · {item.response.replace('_', ' ')}
            </li>
          ))}
        </ul>
      ) : (
        <p>No confirmed attendees yet.</p>
      )}
      {query.hasNextPage && (
        <button
          type="button"
          className="community-action"
          onClick={() => void query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
        >
          Load more attendees
        </button>
      )}
    </section>
  );
}
export default function EventDetailPage() {
  const { eventId = '' } = useParams();
  const query = useEvent(eventId);
  const actions = useEventActions(eventId);
  const [showAttendees, setShowAttendees] = useState(false);
  if (query.isPending) return <LoadingState label="Loading event…" />;
  if (query.isError)
    return <ErrorState message={apiErrorMessage(query.error)} onRetry={() => void query.refetch()} />;
  const event = query.data.event;
  const pending =
    actions.register.isPending ||
    actions.cancelRegistration.isPending ||
    actions.rsvp.isPending ||
    actions.cancel.isPending;
  const actionError =
    actions.register.error || actions.cancelRegistration.error || actions.rsvp.error || actions.cancel.error;
  return (
    <div className="community-page event-page">
      <Link className="community-back" to="/app/events">
        Back to events
      </Link>
      <header className="community-panel">
        <span className="command-activity-type">
          {event.type === 'event' ? 'Professional event' : 'Professional meetup'}
        </span>
        <h1>{event.title}</h1>
        <BookmarkButton type="event" entityId={event.id} />
        <p role="status">
          {event.status === 'cancelled'
            ? 'Cancelled'
            : event.status === 'completed' || new Date(event.startAt) <= new Date()
              ? 'Past'
              : 'Scheduled'}
        </p>
        <p>
          Hosted by {event.organizer.name} in{' '}
          <Link to={`/app/communities/${event.community.slug}`}>{event.community.name}</Link>
        </p>
      </header>
      <section className="community-panel">
        <h2>Details</h2>
        <dl className="event-details">
          <div>
            <dt>Starts</dt>
            <dd>
              <time dateTime={event.startAt}>{displayEventTime(event.startAt, event.timezone)}</time>
            </dd>
          </div>
          <div>
            <dt>Ends</dt>
            <dd>
              <time dateTime={event.endAt}>{displayEventTime(event.endAt, event.timezone)}</time>
            </dd>
          </div>
          <div>
            <dt>Time zone</dt>
            <dd>{event.timezone}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>
              {event.locationType === 'online' ? 'Online' : (event.venueName ?? 'Venue to be announced')}
            </dd>
          </div>
          {event.onlineUrl && (
            <div>
              <dt>Meeting link</dt>
              <dd>
                <a href={event.onlineUrl} target="_blank" rel="noopener noreferrer">
                  Open meeting link
                </a>
              </dd>
            </div>
          )}
          <div>
            <dt>Participation</dt>
            <dd>
              {event.confirmedCount}
              {event.capacity ? ` of ${event.capacity}` : ''}{' '}
              {event.type === 'event' ? 'registered' : 'going'}
              {event.type === 'meetup' ? ` · ${event.interestedCount} interested` : ''}
            </dd>
          </div>
        </dl>
        <p className="community-preserve">{event.description}</p>
      </section>
      {(event.canParticipate || event.myRegistration === 'registered' || event.myRSVP) && (
        <section className="community-panel">
          <h2>{event.type === 'event' ? 'Registration' : 'Your RSVP'}</h2>
          {event.type === 'event' ? (
            event.myRegistration === 'registered' ? (
              <button
                type="button"
                className="community-action"
                disabled={pending}
                onClick={() => actions.cancelRegistration.mutate()}
              >
                {pending ? 'Updating…' : 'Cancel registration'}
              </button>
            ) : event.canParticipate && event.registrationOpen ? (
              <button
                type="button"
                className="community-primary"
                disabled={pending || (event.capacity !== null && event.confirmedCount >= event.capacity)}
                onClick={() => actions.register.mutate()}
              >
                {pending
                  ? 'Registering…'
                  : event.capacity !== null && event.confirmedCount >= event.capacity
                    ? 'Full'
                    : 'Register'}
              </button>
            ) : (
              <p>Registration is closed.</p>
            )
          ) : event.canParticipate ? (
            <label htmlFor="event-rsvp">
              RSVP response{' '}
              <select
                id="event-rsvp"
                value={event.myRSVP ?? ''}
                disabled={pending}
                onChange={(change) => actions.rsvp.mutate(change.target.value as RSVPResponse)}
              >
                <option value="" disabled>
                  Choose a response
                </option>
                <option
                  value="going"
                  disabled={
                    event.myRSVP !== 'going' &&
                    event.capacity !== null &&
                    event.confirmedCount >= event.capacity
                  }
                >
                  Going
                </option>
                <option value="interested">Interested</option>
                <option value="not_going">Not going</option>
              </select>
            </label>
          ) : (
            <p>RSVP changes are closed.</p>
          )}
          {event.myRegistration === 'registered' && <p role="status">You are registered.</p>}
          {event.myRSVP && <p role="status">Your RSVP: {event.myRSVP.replace('_', ' ')}.</p>}
        </section>
      )}
      {event.canManage && (
        <section className="community-panel">
          <h2>Organizer controls</h2>
          <div className="event-controls">
            {event.status === 'scheduled' && new Date(event.startAt) > new Date() && (
              <>
                <Link className="community-action" to={`/app/events/${event.id}/edit`}>
                  Edit event
                </Link>
                <button
                  type="button"
                  className="community-action"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm('Cancel this gathering? Registrations will be preserved.'))
                      actions.cancel.mutate();
                  }}
                >
                  Cancel {event.type}
                </button>
              </>
            )}
            <button
              type="button"
              className="community-action"
              onClick={() => setShowAttendees(!showAttendees)}
            >
              {showAttendees ? 'Hide attendees' : 'Manage attendees'}
            </button>
          </div>
        </section>
      )}
      {actionError && (
        <p role="alert" className="community-error">
          {apiErrorMessage(actionError)}
        </p>
      )}
      {showAttendees && event.canViewAttendees && <Attendees eventId={event.id} />}
    </div>
  );
}
