import { Link, useSearchParams } from 'react-router';
import CommunityEmblem from '@/components/shared/CommunityEmblem';
import CommunityActivityBoard from '@/features/community-commands/components/CommunityActivityBoard';
import { useCommunity, useMyCommunities } from '../hooks/useCommunities';

export default function CommunityInboxPage() {
  const [params] = useSearchParams();
  const mine = useMyCommunities();
  const joined = [
    ...new Map(
      (mine.data?.pages.flatMap((page) => page.items) ?? [])
        .filter((item) => item.membershipStatus === 'ACTIVE')
        .map((item) => [item.id, item] as const)
    ).values()
  ];
  const selectedSlug = params.get('community') || joined[0]?.slug || '';
  const selected = useCommunity(selectedSlug);

  return (
    <section className="community-inbox" aria-label="Community chat">
      <aside className="community-inbox-list" aria-label="Your community conversations">
        <header className="community-inbox-list-heading">
          <h1>Communities</h1>
          <Link to="/app/communities/create" aria-label="Create community" title="Create community">
            +
          </Link>
        </header>
        <div className="community-inbox-conversations">
          {mine.isPending ? (
            <p className="community-inbox-status" role="status">Loading communities…</p>
          ) : mine.isError ? (
            <div className="community-inbox-status" role="alert">
              <p>Communities could not be loaded.</p>
              <button type="button" onClick={() => void mine.refetch()}>Try again</button>
            </div>
          ) : joined.length === 0 ? (
            <div className="community-inbox-status">
              <p>Join a community to start a conversation.</p>
              <Link to="/app/communities">Discover communities</Link>
            </div>
          ) : (
            <>
              {joined.map((item) => (
                <Link
                  key={item.id}
                  to={`/app/community-chat?community=${encodeURIComponent(item.slug)}`}
                  className={`community-inbox-item${selectedSlug === item.slug ? ' active' : ''}`}
                  aria-current={selectedSlug === item.slug ? 'page' : undefined}
                >
                  <CommunityEmblem community={item} />
                  <span className="community-inbox-item-copy">
                    <strong>{item.name}</strong>
                    <small>Community activity</small>
                  </span>
                </Link>
              ))}
              {mine.hasNextPage && (
                <button
                  type="button"
                  className="community-inbox-load"
                  disabled={mine.isFetchingNextPage}
                  onClick={() => void mine.fetchNextPage()}
                >
                  {mine.isFetchingNextPage ? 'Loading…' : 'Load more communities'}
                </button>
              )}
            </>
          )}
        </div>
        <Link className="community-inbox-discover" to="/app/communities">Discover communities</Link>
      </aside>
      <div className="community-inbox-chat">
        {!selectedSlug ? (
          <div className="community-inbox-empty">
            <strong>Your community conversations will appear here.</strong>
            <p>Choose a joined community from the list.</p>
          </div>
        ) : selected.isPending ? (
          <p className="community-inbox-status" role="status">Loading community chat…</p>
        ) : selected.isError ? (
          <div className="community-inbox-status" role="alert">
            <p>Community chat could not be loaded.</p>
            <button type="button" onClick={() => void selected.refetch()}>Try again</button>
          </div>
        ) : selected.data.community.membershipStatus !== 'ACTIVE' ? (
          <div className="community-inbox-empty">
            <strong>Join this community to view its conversation.</strong>
            <Link to={`/app/communities/${selectedSlug}`}>View community</Link>
          </div>
        ) : (
          <CommunityActivityBoard key={selectedSlug} community={selected.data.community} />
        )}
      </div>
    </section>
  );
}
