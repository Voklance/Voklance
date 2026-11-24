import { COMMUNITY_CATEGORY_LABELS } from '@voklance/shared';
import { Link, useParams } from 'react-router';
import { apiErrorMessage } from '@/lib/apiClient';
import { useCommunity, useCommunityActions } from '../hooks/useCommunities';
import CommunityEventsBoard from '@/features/events/components/CommunityEventsBoard';
import CommunityReferralBoard from '@/features/referrals/components/CommunityReferralBoard';

export default function CommunityDetailPage() {
  const { slug = '' } = useParams();
  const query = useCommunity(slug);
  const { join, leave } = useCommunityActions();
  if (query.isPending)
    return (
      <p className="community-state" role="status">
        Loading community…
      </p>
    );
  if (query.isError)
    return (
      <div className="community-state" role="alert">
        <p>Community could not be loaded.</p>
        <button className="community-action" type="button" onClick={() => void query.refetch()}>
          Try again
        </button>
      </div>
    );
  const community = query.data.community;
  const member = community.membershipStatus === 'ACTIVE';
  const privatePreview = community.visibility === 'PRIVATE' && !member;
  return (
    <div className="community-page">
      <Link className="community-back" to="/app/communities">
        Back to communities
      </Link>
      <header className="community-detail-header">
        <div className="community-banner" aria-hidden="true">
          <span>{community.name.charAt(0).toUpperCase()}</span>
        </div>
        <div className="community-detail-heading">
          <div>
            <span className="community-category">{COMMUNITY_CATEGORY_LABELS[community.category]}</span>
            <h1>{community.name}</h1>
            <p>{community.visibility === 'PRIVATE' ? 'Private community' : 'Public community'}</p>
            <p>
              {community.memberCount} {community.memberCount === 1 ? 'member' : 'members'}
            </p>
          </div>
          {community.status === 'ARCHIVED' ? (
            <span role="status">Archived</span>
          ) : member ? (
            community.myRole === 'OWNER' ? (
              <span role="status">Owner</span>
            ) : (
              <button
                className="community-action"
                type="button"
                disabled={leave.isPending}
                onClick={() => leave.mutate(community.id)}
              >
                {leave.isPending ? 'Leaving…' : 'Leave community'}
              </button>
            )
          ) : community.membershipStatus === 'PENDING' ? (
            <>
              <span role="status">Request pending</span>
              <button
                type="button"
                className="community-text-button"
                disabled={leave.isPending}
                onClick={() => leave.mutate(community.id)}
              >
                Cancel request
              </button>
            </>
          ) : (
            <button
              className="community-primary"
              type="button"
              disabled={join.isPending}
              onClick={() => join.mutate(community.id)}
            >
              {join.isPending
                ? 'Working…'
                : community.visibility === 'PRIVATE'
                  ? 'Request to join'
                  : 'Join community'}
            </button>
          )}
        </div>
      </header>
      {(join.isError || leave.isError) && (
        <p role="alert" className="community-error">
          {apiErrorMessage(join.error ?? leave.error)}
        </p>
      )}
      {!privatePreview && (
        <Link className="community-primary community-chat-entry" to={`/app/communities/${slug}/chat`}>
          {member ? 'Open community chat' : 'View community chat'}
        </Link>
      )}
      {privatePreview ? (
        <section className="community-panel">
          <h2>About this community</h2>
          <p>Join to see the full description, rules, and member directory.</p>
        </section>
      ) : (
        <>
          <section className="community-panel">
            <h2>About this community</h2>
            <p>{community.description}</p>
            {community.tags.length > 0 && (
              <ul className="community-tags" aria-label="Topics">
                {community.tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            )}
          </section>
          {community.rules && (
            <section className="community-panel">
              <h2>Community rules</h2>
              <p className="community-preserve">{community.rules}</p>
            </section>
          )}
          {community.owner && (
            <section className="community-panel">
              <h2>Created by</h2>
              {community.owner.username ? (
                <Link to={`/app/professionals/${community.owner.username}`}>{community.owner.name}</Link>
              ) : (
                <p>{community.owner.name}</p>
              )}
              {community.owner.headline && <p>{community.owner.headline}</p>}
            </section>
          )}
        </>
      )}
      {member && (
        <nav className="community-detail-links" aria-label="Community management">
          <Link to={`/app/communities/${slug}/members`}>Member directory</Link>
          {community.permissions.reviewRequests && (
            <Link to={`/app/communities/${slug}/requests`}>Membership requests</Link>
          )}
          {community.permissions.editDetails && (
            <Link to={`/app/communities/${slug}/settings`}>Settings</Link>
          )}
        </nav>
      )}
      {!privatePreview && <CommunityReferralBoard communityId={community.id} />}
      {!privatePreview && (
        <Link className="community-action" to={`/app/communities/${slug}/resources`}>
          Browse community resources
        </Link>
      )}
      {!privatePreview && <CommunityEventsBoard communityId={community.id} />}
    </div>
  );
}
