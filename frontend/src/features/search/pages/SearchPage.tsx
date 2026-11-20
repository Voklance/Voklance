import { SEARCH_CATEGORIES, type SearchCategory, type SearchResult } from '@voklance/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { searchApi, type SearchFilters } from '../api/searchApi';

const labels: Record<SearchCategory, string> = {
  all: 'All',
  people: 'People',
  communities: 'Communities',
  posts: 'Posts',
  events: 'Events',
  referrals: 'Referrals',
  resources: 'Resources',
  github: 'GitHub'
};
const recentKey = 'voklance-recent-searches';
function history() {
  try {
    return JSON.parse(localStorage.getItem(recentKey) ?? '[]') as string[];
  } catch {
    return [];
  }
}
function remember(q: string) {
  localStorage.setItem(
    recentKey,
    JSON.stringify([q, ...history().filter((item) => item.toLowerCase() !== q.toLowerCase())].slice(0, 8))
  );
}
function ResultCard({ result }: { result: SearchResult }) {
  return (
    <article className="search-result-card">
      <span className="search-result-category">{labels[result.category]}</span>
      <h3>
        <Link to={result.href}>{result.title}</Link>
      </h3>
      {result.description && <p>{result.description}</p>}
      <div className="search-result-meta">
        {Object.entries(result.metadata)
          .filter(([, value]) => value !== null && value !== '')
          .slice(0, 4)
          .map(([key, value]) => (
            <span key={key}>
              {key}: {String(value)}
            </span>
          ))}
      </div>
    </article>
  );
}
export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q')?.trim() ?? '';
  const category = SEARCH_CATEGORIES.includes(params.get('category') as SearchCategory)
    ? (params.get('category') as SearchCategory)
    : 'all';
  const [draft, setDraft] = useState(q);
  const [recent, setRecent] = useState<string[]>(history);
  useEffect(() => setDraft(q), [q]);
  useEffect(() => {
    if (q.length >= 2) {
      remember(q);
      setRecent(history());
    }
  }, [q]);
  const filters: SearchFilters = {
    q,
    category,
    sort: params.get('sort') ?? 'relevance',
    location: params.get('location') || undefined,
    skill: params.get('skill') || undefined,
    communityCategory: params.get('communityCategory') || undefined,
    eventType: params.get('eventType') || undefined,
    upcoming: params.get('upcoming') || undefined,
    resourceCategory: params.get('resourceCategory') || undefined,
    language: params.get('language') || undefined,
    featuredOnly: params.get('featuredOnly') || undefined
  };
  const query = useInfiniteQuery({
    queryKey: ['search', filters],
    queryFn: ({ pageParam }) => searchApi.results(filters, pageParam || undefined),
    initialPageParam: '' as string,
    getNextPageParam: (page) => (page.hasMore ? (page.nextCursor ?? undefined) : undefined),
    enabled: q.length >= 2
  });
  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === 'q') next.delete('category');
    setParams(next);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    update('q', draft.trim());
  }
  const page = query.data?.pages[0];
  const items = query.data?.pages.flatMap((entry) => entry.items) ?? [];
  return (
    <div className="search-page">
      <header className="search-page-heading">
        <h1>Search Voklance</h1>
        <p>Find published professional work and communities you can access.</p>
      </header>
      <form onSubmit={submit} className="search-page-form" role="search">
        <label htmlFor="search-query">Search term</label>
        <div>
          <input
            id="search-query"
            type="search"
            value={draft}
            maxLength={100}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Try React, design, or a role"
          />
          <button type="submit">Search</button>
        </div>
      </form>
      {q.length < 2 ? (
        <section className="search-empty">
          <p>Enter at least two characters to search.</p>
          {recent.length > 0 && (
            <>
              <h2>Recent searches</h2>
              <ul>
                {recent.map((term) => (
                  <li key={term}>
                    <button type="button" onClick={() => update('q', term)}>
                      {term}
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem(recentKey);
                  setRecent([]);
                }}
              >
                Clear history
              </button>
            </>
          )}
        </section>
      ) : (
        <>
          <nav className="search-tabs" aria-label="Search categories">
            {SEARCH_CATEGORIES.map((tab) => (
              <button
                type="button"
                key={tab}
                className={category === tab ? 'active' : ''}
                aria-current={category === tab ? 'page' : undefined}
                onClick={() => update('category', tab === 'all' ? '' : tab)}
              >
                {labels[tab]}
              </button>
            ))}
          </nav>
          <div className="search-layout">
            <aside className="search-filters" aria-label="Search filters">
              <h2>Filter results</h2>
              <label>
                Sort{' '}
                <select value={filters.sort} onChange={(event) => update('sort', event.target.value)}>
                  <option value="relevance">Relevance</option>
                  <option value="recent">Recent</option>
                </select>
              </label>
              {category === 'people' && (
                <>
                  <label>
                    Location{' '}
                    <input
                      value={filters.location ?? ''}
                      onChange={(event) => update('location', event.target.value)}
                      placeholder="City or country"
                    />
                  </label>
                  <label>
                    Skill slug{' '}
                    <input
                      value={filters.skill ?? ''}
                      onChange={(event) => update('skill', event.target.value)}
                      placeholder="react"
                    />
                  </label>
                </>
              )}
              {category === 'communities' && (
                <label>
                  Category{' '}
                  <input
                    value={filters.communityCategory ?? ''}
                    onChange={(event) => update('communityCategory', event.target.value)}
                    placeholder="Category slug"
                  />
                </label>
              )}
              {category === 'events' && (
                <>
                  <label>
                    Event type{' '}
                    <select
                      value={filters.eventType ?? ''}
                      onChange={(event) => update('eventType', event.target.value)}
                    >
                      <option value="">All</option>
                      <option value="event">Events</option>
                      <option value="meetup">Meetups</option>
                    </select>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={filters.upcoming === 'true'}
                      onChange={(event) => update('upcoming', event.target.checked ? 'true' : '')}
                    />{' '}
                    Upcoming only
                  </label>
                </>
              )}
              {category === 'resources' && (
                <label>
                  Category{' '}
                  <input
                    value={filters.resourceCategory ?? ''}
                    onChange={(event) => update('resourceCategory', event.target.value)}
                    placeholder="Category slug"
                  />
                </label>
              )}
              {category === 'github' && (
                <>
                  <label>
                    Language{' '}
                    <input
                      value={filters.language ?? ''}
                      onChange={(event) => update('language', event.target.value)}
                      placeholder="TypeScript"
                    />
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={filters.featuredOnly === 'true'}
                      onChange={(event) => update('featuredOnly', event.target.checked ? 'true' : '')}
                    />{' '}
                    Featured projects
                  </label>
                </>
              )}
            </aside>
            <main className="search-results" aria-live="polite">
              {query.isPending ? (
                <p role="status">Searching…</p>
              ) : query.isError ? (
                <div role="alert">
                  <p>Search could not be loaded.</p>
                  <button type="button" onClick={() => void query.refetch()}>
                    Try again
                  </button>
                </div>
              ) : category === 'all' ? (
                <>
                  {SEARCH_CATEGORIES.filter((item) => item !== 'all').map((section) => {
                    const preview = page?.previews?.[section as Exclude<SearchCategory, 'all'>] ?? [];
                    return (
                      <section key={section} className="search-preview">
                        <div className="search-preview-heading">
                          <h2>{labels[section]}</h2>
                          <button type="button" onClick={() => update('category', section)}>
                            View all
                          </button>
                        </div>
                        {preview.length ? (
                          preview.map((result) => <ResultCard key={result.id} result={result} />)
                        ) : (
                          <p>No matches in {labels[section].toLowerCase()}.</p>
                        )}
                      </section>
                    );
                  })}
                </>
              ) : items.length ? (
                <>
                  <h2>{labels[category]} results</h2>
                  {items.map((result) => (
                    <ResultCard key={result.id} result={result} />
                  ))}
                  {query.hasNextPage && (
                    <button
                      type="button"
                      className="search-load"
                      disabled={query.isFetchingNextPage}
                      onClick={() => void query.fetchNextPage()}
                    >
                      {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
                    </button>
                  )}
                </>
              ) : (
                <p>No {labels[category].toLowerCase()} match this search. Try another term or filter.</p>
              )}
            </main>
          </div>
        </>
      )}
    </div>
  );
}
