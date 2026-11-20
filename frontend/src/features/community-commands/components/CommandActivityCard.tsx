import type { CommunityActivity } from '@voklance/shared';
import { Link } from 'react-router';
import { apiErrorMessage } from '@/lib/apiClient';
import { useCommandActions } from '../hooks/useCommunityCommands';
import { displayEventTime } from '@/features/events/utils/zonedDateTime';

function SafeLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
export default function CommandActivityCard({ activity }: { activity: CommunityActivity }) {
  const { remove } = useCommandActions(activity.communityId);
  const details = (() => {
    switch (activity.command) {
      case 'referral':
        return (
          <>
            <h3>{activity.payload.jobTitle}</h3>
            <p>{activity.payload.company}</p>
            <dl>
              <div>
                <dt>Location</dt>
                <dd>{activity.payload.location}</dd>
              </div>
              <div>
                <dt>Work mode</dt>
                <dd>{activity.payload.workMode}</dd>
              </div>
              {activity.payload.expiresAt && (
                <div>
                  <dt>Expires</dt>
                  <dd>{new Date(activity.payload.expiresAt).toLocaleString()}</dd>
                </div>
              )}
            </dl>
            <p>{activity.payload.description}</p>
            <SafeLink href={activity.payload.jobUrl}>View job</SafeLink>
          </>
        );
      case 'needreferral':
        return (
          <>
            <h3>{activity.payload.jobTitle}</h3>
            <p>{activity.payload.company}</p>
            <dl>
              <div>
                <dt>Experience</dt>
                <dd>{activity.payload.experienceLevel}</dd>
              </div>
            </dl>
            <p>{activity.payload.message}</p>
            {activity.payload.jobUrl && <SafeLink href={activity.payload.jobUrl}>View role</SafeLink>}
          </>
        );
      case 'event':
        return (
          <>
            <h3>{activity.payload.title}</h3>
            <dl>
              <div>
                <dt>Starts</dt>
                <dd>{displayEventTime(activity.payload.startAt, activity.payload.timezone ?? 'UTC')}</dd>
              </div>
              {activity.payload.endAt && (
                <div>
                  <dt>Ends</dt>
                  <dd>{displayEventTime(activity.payload.endAt, activity.payload.timezone ?? 'UTC')}</dd>
                </div>
              )}
              <div>
                <dt>Location</dt>
                <dd>
                  {activity.payload.locationType === 'online'
                    ? 'Online · link available to confirmed participants'
                    : activity.payload.locationOrUrl}
                </dd>
              </div>
            </dl>
            <p>{activity.payload.description}</p>
          </>
        );
      case 'meetup':
        return (
          <>
            <h3>{activity.payload.title}</h3>
            <dl>
              <div>
                <dt>Scheduled</dt>
                <dd>{displayEventTime(activity.payload.scheduledAt, activity.payload.timezone ?? 'UTC')}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>
                  {activity.payload.locationType === 'online'
                    ? 'Online · link available to confirmed participants'
                    : activity.payload.locationOrUrl}
                </dd>
              </div>
              {activity.payload.capacity && (
                <div>
                  <dt>Capacity</dt>
                  <dd>{activity.payload.capacity}</dd>
                </div>
              )}
            </dl>
            <p>{activity.payload.description}</p>
          </>
        );
      case 'resource':
        return (
          <>
            <h3>{activity.payload.title}</h3>
            <p>{activity.payload.description}</p>
            <p>{activity.payload.category.replaceAll('-', ' ')}</p>
            {activity.payload.tags.length > 0 && <p>Topics: {activity.payload.tags.join(', ')}</p>}
          </>
        );
    }
  })();
  return (
    <article className="command-activity">
      <header className="command-activity-header">
        <span className="community-member-avatar" aria-hidden="true">
          {activity.author.name.charAt(0).toUpperCase()}
        </span>
        <div>
          <strong>
            {activity.author.username ? (
              <Link to={`/app/professionals/${activity.author.username}`}>{activity.author.name}</Link>
            ) : (
              activity.author.name
            )}
          </strong>
          {activity.author.headline && <p>{activity.author.headline}</p>}
          <time dateTime={activity.createdAt}>{new Date(activity.createdAt).toLocaleString()}</time>
        </div>
        <span className="command-activity-type">{activity.commandLabel}</span>
      </header>
      <div className="command-activity-content">{details}</div>
      {(activity.command === 'referral' || activity.command === 'needreferral') && (
        <div className="referral-card-links">
          <span className="referral-status" data-status={activity.referralStatus?.toLowerCase()}>
            {activity.referralStatus?.toLowerCase() ?? 'open'}
          </span>
          <Link
            to={
              activity.command === 'referral'
                ? `/app/referrals/opportunities/${activity.id}`
                : `/app/referrals/needs/${activity.id}`
            }
          >
            {activity.command === 'referral'
              ? 'Request referral or view details'
              : 'Offer referral or view details'}
          </Link>
        </div>
      )}
      {(activity.command === 'event' || activity.command === 'meetup') && activity.eventId && (
        <div className="referral-card-links">
          <span role="status">{activity.eventStatus ?? 'scheduled'}</span>
          <Link to={`/app/events/${activity.eventId}`}>View {activity.command} details</Link>
        </div>
      )}
      {activity.command === 'resource' && activity.resourceId && (
        <Link to={`/app/resources/${activity.resourceId}`}>View resource</Link>
      )}
      {activity.canDelete &&
        activity.command !== 'referral' &&
        activity.command !== 'needreferral' &&
        activity.command !== 'resource' &&
        !activity.eventId && (
          <button
            type="button"
            className="community-text-button"
            disabled={remove.isPending}
            onClick={() => {
              if (window.confirm('Delete this activity?')) remove.mutate(activity.id);
            }}
          >
            {remove.isPending ? 'Deleting…' : 'Delete activity'}
          </button>
        )}
      {remove.isError && (
        <p className="command-error" role="alert">
          {apiErrorMessage(remove.error)}
        </p>
      )}
    </article>
  );
}
