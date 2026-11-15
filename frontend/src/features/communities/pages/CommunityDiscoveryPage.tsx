import { COMMUNITY_CATEGORIES, COMMUNITY_CATEGORY_LABELS } from '@voklance/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import CommunityCard from '../components/CommunityCard';
import { useCommunities } from '../hooks/useCommunities';

export default function CommunityDiscoveryPage() {
  const [params, setParams] = useSearchParams();
  const searchParam = params.get('search') ?? '';
  const [draft, setDraft] = useState(searchParam);
  useEffect(() => setDraft(searchParam), [searchParam]);
  const filters = {
    search: params.get('search') || undefined,
    category: params.get('category') || undefined,
    visibility: params.get('visibility') || undefined
  };
  const query = useCommunities(filters);
  const items = [
    ...new Map(query.data?.pages.flatMap((page) => page.items).map((item) => [item.id, item]) ?? []).values()
  ];
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };
  const search = (event: FormEvent) => {
    event.preventDefault();
    update('search', draft.trim());
  };
  return (
    <div className="community-page">
      <header className="community-page-header">
        <div>
          <h1>Discover professional communities</h1>
          <p>Find people working on the skills and fields you care about.</p>
        </div>
        <Link className="community-primary" to="/app/communities/create">
          Create community
        </Link>
      </header>
      <form className="community-filters" onSubmit={search} role="search">
        <label>
          Search communities
          <input
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Name or public topic"
          />
        </label>
        <button type="submit" className="community-action">
          Search
        </button>
        <label>
          Category
          <select value={filters.category ?? ''} onChange={(event) => update('category', event.target.value)}>
            <option value="">All categories</option>
            {COMMUNITY_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {COMMUNITY_CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Visibility
          <select
            value={filters.visibility ?? ''}
            onChange={(event) => update('visibility', event.target.value)}
          >
            <option value="">Public and private</option>
            <option value="PUBLIC">Public</option>
            <option value="PRIVATE">Private</option>
          </select>
        </label>
      </form>
      {query.isPending ? (
        <p className="community-state" role="status">
          Loading communities…
        </p>
      ) : query.isError ? (
        <div className="community-state" role="alert">
          <p>Communities could not be loaded.</p>
          <button type="button" className="community-action" onClick={() => void query.refetch()}>
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="community-state">
          <p>No communities match these filters.</p>
          <Link to="/app/communities/create">Create a community</Link>
        </div>
      ) : (
        <>
          <div className="community-grid">
            {items.map((item) => (
              <CommunityCard key={item.id} community={item} />
            ))}
          </div>
          {query.hasNextPage && (
            <button
              type="button"
              className="community-load"
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {query.isFetchingNextPage ? 'Loading…' : 'Load more communities'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
