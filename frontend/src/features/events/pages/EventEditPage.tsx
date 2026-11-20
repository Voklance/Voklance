import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import LoadingState from '@/components/shared/LoadingState';
import ErrorState from '@/components/shared/ErrorState';
import { apiErrorMessage } from '@/lib/apiClient';
import { useEvent, useEventActions } from '../hooks/useEvents';
import { wallClockValue, zonedDateTime } from '../utils/zonedDateTime';

export default function EventEditPage() {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const query = useEvent(eventId);
  const actions = useEventActions(eventId);
  const [error, setError] = useState('');
  if (query.isPending) return <LoadingState label="Loading event…" />;
  if (query.isError)
    return <ErrorState message={apiErrorMessage(query.error)} onRetry={() => void query.refetch()} />;
  const event = query.data.event;
  if (!event.canManage || event.status !== 'scheduled')
    return <ErrorState message="This event cannot be edited." />;
  const save = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    const form = new FormData(formEvent.currentTarget);
    const get = (key: string) => String(form.get(key) ?? '').trim();
    try {
      const timezone = get('timezone');
      const body: Record<string, unknown> = {
        title: get('title'),
        description: get('description'),
        category: get('category') || null,
        startAt: zonedDateTime(get('startAt'), timezone),
        endAt: zonedDateTime(get('endAt'), timezone),
        timezone,
        locationType: get('locationType'),
        venueName: get('venueName') || null,
        onlineUrl: get('onlineUrl') || null,
        capacity: get('capacity') ? Number(get('capacity')) : null,
        registrationOpen: get('registrationOpen') === 'on'
      };
      if (event.type === 'meetup') delete body.registrationOpen;
      if (new Date(body.endAt as string) <= new Date(body.startAt as string)) {
        setError('End time must be after start time.');
        return;
      }
      setError('');
      actions.edit.mutate(body, { onSuccess: () => navigate(`/app/events/${event.id}`) });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Check the schedule.');
    }
  };
  return (
    <div className="community-page event-page">
      <Link className="community-back" to={`/app/events/${event.id}`}>
        Back to event
      </Link>
      <h1>Edit {event.type}</h1>
      <form className="community-panel event-edit-form" onSubmit={save}>
        <label>
          Title
          <input name="title" required minLength={3} maxLength={160} defaultValue={event.title} />
        </label>
        <label>
          Description
          <textarea
            name="description"
            required
            minLength={10}
            maxLength={2000}
            defaultValue={event.description}
            rows={5}
          />
        </label>
        <label>
          Category
          <input name="category" maxLength={80} defaultValue={event.category ?? ''} />
        </label>
        <label>
          Start
          <input
            name="startAt"
            type="datetime-local"
            required
            defaultValue={wallClockValue(event.startAt, event.timezone)}
          />
        </label>
        <label>
          End
          <input
            name="endAt"
            type="datetime-local"
            required
            defaultValue={wallClockValue(event.endAt, event.timezone)}
          />
        </label>
        <label>
          IANA time zone
          <input name="timezone" required defaultValue={event.timezone} />
        </label>
        <label>
          Location type
          <select name="locationType" defaultValue={event.locationType}>
            <option value="online">Online</option>
            <option value="in_person">In person</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </label>
        <label>
          Venue
          <input name="venueName" maxLength={200} defaultValue={event.venueName ?? ''} />
        </label>
        <label>
          Meeting URL (HTTPS)
          <input name="onlineUrl" type="url" defaultValue={event.onlineUrl ?? ''} />
        </label>
        <label>
          Capacity
          <input name="capacity" type="number" min={1} max={10000} defaultValue={event.capacity ?? ''} />
        </label>
        {event.type === 'event' && (
          <label className="event-checkbox">
            <input name="registrationOpen" type="checkbox" defaultChecked={event.registrationOpen} />
            Registration open
          </label>
        )}
        {error && (
          <p role="alert" className="community-error">
            {error}
          </p>
        )}
        {actions.edit.isError && (
          <p role="alert" className="community-error">
            {apiErrorMessage(actions.edit.error)}
          </p>
        )}
        <button type="submit" className="community-primary" disabled={actions.edit.isPending}>
          {actions.edit.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
