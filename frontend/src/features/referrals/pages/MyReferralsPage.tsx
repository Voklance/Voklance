import { Link } from 'react-router';
import { ReferralStatusBadge } from '../components/ReferralCards';
import { useMyApplications, useMyNeeds, useMyOffers, useMyOpportunities } from '../hooks/useReferrals';

type Row = {
  id: string;
  title: string;
  status: string;
  path: string | null;
  community: { slug: string; name: string } | null;
};
function Section({
  title,
  rows,
  pending,
  error,
  hasMore,
  loadingMore,
  onMore,
  onRetry
}: {
  title: string;
  rows: Row[];
  pending: boolean;
  error: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
  onRetry: () => void;
}) {
  return (
    <section className="referral-dashboard-section">
      <h2>{title}</h2>
      {pending ? (
        <p role="status">Loading {title.toLowerCase()}…</p>
      ) : error ? (
        <div role="alert">
          Could not load {title.toLowerCase()}.{' '}
          <button type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : rows.length === 0 ? (
        <p>No {title.toLowerCase()} yet.</p>
      ) : (
        <>
          <ul>
            {rows.map((row) => (
              <li key={row.id}>
                <div>
                  <strong>{row.path ? <Link to={row.path}>{row.title}</Link> : row.title}</strong>
                  {row.community && (
                    <Link className="referral-community-link" to={`/app/communities/${row.community.slug}`}>
                      {row.community.name}
                    </Link>
                  )}
                </div>
                <ReferralStatusBadge status={row.status} />
              </li>
            ))}
          </ul>
          {hasMore && (
            <button type="button" className="community-load" disabled={loadingMore} onClick={onMore}>
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
    </section>
  );
}
export default function MyReferralsPage() {
  const opportunities = useMyOpportunities();
  const needs = useMyNeeds();
  const applications = useMyApplications();
  const offers = useMyOffers();
  const opportunityRows: Row[] = (opportunities.data?.pages.flatMap((page) => page.items) ?? []).map(
    (item) => ({
      id: item.id,
      title: `${item.details.jobTitle} · ${item.details.company}`,
      status: item.status,
      path: `/app/referrals/opportunities/${item.id}`,
      community: item.community
    })
  );
  const needRows: Row[] = (needs.data?.pages.flatMap((page) => page.items) ?? []).map((item) => ({
    id: item.id,
    title: `${item.details.jobTitle} · ${item.details.company}`,
    status: item.status,
    path: `/app/referrals/needs/${item.id}`,
    community: item.community
  }));
  const applicationRows: Row[] = (applications.data?.pages.flatMap((page) => page.items) ?? []).map(
    (item) => ({
      id: item.response.id,
      title: item.target
        ? `${item.target.details.jobTitle} · ${item.target.details.company}`
        : 'Referral opportunity unavailable',
      status: item.response.status,
      path: item.target ? `/app/referrals/opportunities/${item.target.id}` : null,
      community: item.target?.community ?? null
    })
  );
  const offerRows: Row[] = (offers.data?.pages.flatMap((page) => page.items) ?? []).map((item) => ({
    id: item.response.id,
    title: item.target
      ? `${item.target.details.jobTitle} · ${item.target.details.company}`
      : 'Referral request unavailable',
    status: item.response.status,
    path: item.target ? `/app/referrals/needs/${item.target.id}` : null,
    community: item.target?.community ?? null
  }));
  return (
    <div className="referral-page">
      <header className="referral-page-header">
        <span className="referral-kicker">Career collaboration</span>
        <h1>My referrals</h1>
        <p>
          Track the opportunities you posted, requests you made, and offers you sent. An accepted response
          does not mean an employer referral was submitted.
        </p>
      </header>
      <div className="referral-dashboard-grid">
        <Section
          title="My opportunities"
          rows={opportunityRows}
          pending={opportunities.isPending}
          error={opportunities.isError}
          hasMore={!!opportunities.hasNextPage}
          loadingMore={opportunities.isFetchingNextPage}
          onMore={() => void opportunities.fetchNextPage()}
          onRetry={() => void opportunities.refetch()}
        />
        <Section
          title="Requests I sent"
          rows={applicationRows}
          pending={applications.isPending}
          error={applications.isError}
          hasMore={!!applications.hasNextPage}
          loadingMore={applications.isFetchingNextPage}
          onMore={() => void applications.fetchNextPage()}
          onRetry={() => void applications.refetch()}
        />
        <Section
          title="Referral requests I posted"
          rows={needRows}
          pending={needs.isPending}
          error={needs.isError}
          hasMore={!!needs.hasNextPage}
          loadingMore={needs.isFetchingNextPage}
          onMore={() => void needs.fetchNextPage()}
          onRetry={() => void needs.refetch()}
        />
        <Section
          title="Offers I made"
          rows={offerRows}
          pending={offers.isPending}
          error={offers.isError}
          hasMore={!!offers.hasNextPage}
          loadingMore={offers.isFetchingNextPage}
          onMore={() => void offers.fetchNextPage()}
          onRetry={() => void offers.refetch()}
        />
      </div>
    </div>
  );
}
