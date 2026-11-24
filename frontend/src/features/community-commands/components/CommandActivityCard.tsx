import type { CommunityActivity } from '@voklance/shared';
import { Link } from 'react-router';
import { apiErrorMessage } from '@/lib/apiClient';
import { useCommandActions } from '../hooks/useCommunityCommands';
import { displayEventTime } from '@/features/events/utils/zonedDateTime';
import { useResource } from '@/features/resources/hooks/useResources';

function SafeLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
function ResourceAttachment({ resourceId }: { resourceId: string }) {
  const resource = useResource(resourceId);
  if (!resource.data)
    return (
      <Link className="command-activity-resource-link" to={`/app/resources/${resourceId}`}>
        View resource
      </Link>
    );
  const file = resource.data.resource.file;
  return (
    <Link className="command-resource-attachment" to={`/app/resources/${resourceId}`}>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 3h9l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm9 0v5h4M8 12h8m-8 4h8" />
      </svg>
      <span>
        <strong>{file.safeFilename}</strong>
        <small>{file.mimeType === 'application/pdf' ? 'PDF Document' : 'Document'}</small>
      </span>
      <span aria-hidden="true">↗</span>
    </Link>
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
            <p>Company: {activity.payload.company}</p>
            <dl>
              {(activity.payload.experienceMin !== undefined ||
                activity.payload.experienceMax !== undefined) && (
                <div>
                  <dt>Experience</dt>
                  <dd>
                    {activity.payload.experienceMin ?? 0}–{activity.payload.experienceMax ?? 'more'} years
                  </dd>
                </div>
              )}
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
            {'url' in activity.payload && <SafeLink href={activity.payload.url}>Open resource link</SafeLink>}
          </>
        );
      case 'discussion':
        return (
          <>
            <h3>{activity.payload.title}</h3>
            <p className="command-discussion-body">{activity.payload.body}</p>
          </>
        );
    }
  })();
  return (
    <article className="command-activity">
      <span className="community-chat-author-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="7" r="3" />
          <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
        </svg>
      </span>
      <div className="command-message">
        <header className="command-activity-header">
          <strong>
            {activity.author.username ? (
              <Link to={`/app/professionals/${activity.author.username}`}>{activity.author.name}</Link>
            ) : (
              activity.author.name
            )}
          </strong>
          <time dateTime={activity.createdAt}>
            {new Date(activity.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </time>
        </header>
        <div className="command-activity-bubble">
          <span className="command-activity-type">/{activity.command}</span>
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
                {activity.command === 'referral' ? 'View referral' : 'View request'}
              </Link>
            </div>
          )}
          {(activity.command === 'event' || activity.command === 'meetup') && activity.eventId && (
            <div className="referral-card-links">
              <span role="status">{activity.eventStatus ?? 'scheduled'}</span>
              <Link to={`/app/events/${activity.eventId}`}>View event</Link>
            </div>
          )}
          {activity.command === 'resource' && activity.resourceId && (
            <ResourceAttachment resourceId={activity.resourceId} />
          )}
          {activity.canDelete &&
            activity.command !== 'referral' &&
            activity.command !== 'needreferral' &&
            (activity.command !== 'resource' || !activity.resourceId) &&
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
        </div>
      </div>
    </article>
  );
}
