import type { CommunitySummary } from '@voklance/shared';
import { Link } from 'react-router';
import { COMMUNITY_CATEGORY_LABELS } from '@voklance/shared';
import { apiErrorMessage } from '@/lib/apiClient';
import { useCommunityActions } from '../hooks/useCommunities';

export default function CommunityCard({ community }: { community: CommunitySummary }) {
  const { join } = useCommunityActions();
  return (
    <article className="community-card">
      <div className="community-card-top">
        <span className="community-category">{COMMUNITY_CATEGORY_LABELS[community.category]}</span>
        <span className="community-visibility">
          {community.visibility === 'PRIVATE' ? 'Private' : 'Public'}
        </span>
      </div>
      <h2>
        <Link to={`/app/communities/${community.slug}`}>{community.name}</Link>
      </h2>
      {community.description && <p>{community.description}</p>}
      {community.visibility === 'PRIVATE' && !community.description && (
        <p>Request to join for full details.</p>
      )}
      {community.tags.length > 0 && (
        <ul className="community-tags" aria-label="Topics">
          {community.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      )}
      <div className="community-card-footer">
        <span>
          {community.memberCount} {community.memberCount === 1 ? 'member' : 'members'}
        </span>
        {community.membershipStatus === 'ACTIVE' ? (
          <span role="status">Joined</span>
        ) : community.membershipStatus === 'PENDING' ? (
          <span role="status">Request pending</span>
        ) : (
          <button
            type="button"
            className="community-action"
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
      {join.isError && (
        <p className="community-error" role="alert">
          {apiErrorMessage(join.error)}
        </p>
      )}
    </article>
  );
}
