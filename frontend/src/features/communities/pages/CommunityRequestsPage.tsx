import { Link, useParams } from 'react-router';
import { apiErrorMessage } from '@/lib/apiClient';
import { useCommunity, useCommunityActions, useMembershipRequests } from '../hooks/useCommunities';

export default function CommunityRequestsPage() {
  const { slug = '' } = useParams();
  const detail = useCommunity(slug);
  const id = detail.data?.community.id ?? '';
  const list = useMembershipRequests(id, !!detail.data?.community.permissions.reviewRequests);
  const { decide } = useCommunityActions();
  if (detail.isPending)
    return (
      <p className="community-state" role="status">
        Loading community…
      </p>
    );
  if (detail.isError)
    return (
      <p className="community-state" role="alert">
        Community could not be loaded.
      </p>
    );
  const community = detail.data.community;
  if (!community.permissions.reviewRequests)
    return (
      <p className="community-state" role="alert">
        You cannot review membership requests.
      </p>
    );
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <div className="community-page">
      <Link className="community-back" to={`/app/communities/${slug}`}>
        Back to {community.name}
      </Link>
      <header className="community-page-header">
        <div>
          <h1>Membership requests</h1>
          <p>Review people who want to join {community.name}.</p>
        </div>
      </header>
      {decide.isError && (
        <p className="community-error" role="alert">
          {apiErrorMessage(decide.error)}
        </p>
      )}
      {list.isPending ? (
        <p className="community-state" role="status">
          Loading requests…
        </p>
      ) : list.isError ? (
        <div className="community-state" role="alert">
          <p>Requests could not be loaded.</p>
          <button type="button" className="community-action" onClick={() => void list.refetch()}>
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="community-state">No pending requests.</p>
      ) : (
        <>
          <ul className="community-member-list">
            {items.map((item) => (
              <li key={item.id} className="community-member">
                <span className="community-member-avatar" aria-hidden="true">
                  {item.member.name.charAt(0).toUpperCase()}
                </span>
                <div className="community-member-info">
                  <strong>
                    {item.member.username ? (
                      <Link to={`/app/professionals/${item.member.username}`}>{item.member.name}</Link>
                    ) : (
                      item.member.name
                    )}
                  </strong>
                  {item.member.headline && <p>{item.member.headline}</p>}
                </div>
                <div className="community-request-actions">
                  <button
                    type="button"
                    className="community-action"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ id, requestId: item.id, approve: true })}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="community-text-button"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ id, requestId: item.id, approve: false })}
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {list.hasNextPage && (
            <button
              type="button"
              className="community-load"
              disabled={list.isFetchingNextPage}
              onClick={() => void list.fetchNextPage()}
            >
              {list.isFetchingNextPage ? 'Loading…' : 'Load more requests'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
