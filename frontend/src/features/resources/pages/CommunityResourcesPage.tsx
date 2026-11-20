import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { RESOURCE_CATEGORIES, RESOURCE_CATEGORY_LABELS, type ResourceCategory } from '@voklance/shared';
import { useCommunity } from '@/features/communities/hooks/useCommunities';
import { apiErrorMessage } from '@/lib/apiClient';
import ResourceCard from '../components/ResourceCard';
import ResourceModerationPanel from '../components/ResourceModerationPanel';
import { useCommunityResources } from '../hooks/useResources';

export default function CommunityResourcesPage() {
  const { slug = '' } = useParams();
  const community = useCommunity(slug);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ResourceCategory | undefined>();
  const [tag, setTag] = useState('');
  const id = community.data?.community.id ?? '';
  const resources = useCommunityResources(id, {
    ...(search.trim().length >= 2 ? { search: search.trim() } : {}),
    category,
    ...(tag.trim().length >= 2 ? { tag: tag.trim().toLowerCase() } : {})
  });
  const items = resources.data?.pages.flatMap((page) => page.items) ?? [];
  if (community.isPending) return <p role="status">Loading community…</p>;
  if (community.isError) return <p role="alert">{apiErrorMessage(community.error)}</p>;
  const detail = community.data.community;
  const moderator =
    detail.membershipStatus === 'ACTIVE' && ['OWNER', 'ADMIN', 'MODERATOR'].includes(detail.myRole ?? '');
  return (
    <div className="community-page resource-page">
      <Link className="community-back" to={`/app/communities/${slug}`}>
        Back to community
      </Link>
      <header>
        <h1>{detail.name} resources</h1>
        <p>Professional documents shared with this community.</p>
      </header>
      <div className="community-panel resource-filters">
        <label>
          Search resources
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            maxLength={100}
            placeholder="Title or description"
          />
        </label>
        <label>
          Category
          <select
            value={category ?? ''}
            onChange={(event) =>
              setCategory((event.target.value || undefined) as ResourceCategory | undefined)
            }
          >
            <option value="">All categories</option>
            {RESOURCE_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {RESOURCE_CATEGORY_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tag
          <input
            value={tag}
            onChange={(event) => setTag(event.target.value)}
            maxLength={30}
            placeholder="e.g. react"
          />
        </label>
      </div>
      <section aria-live="polite">
        <h2>Documents</h2>
        {resources.isPending ? (
          <p role="status">Loading resources…</p>
        ) : resources.isError ? (
          <div role="alert">
            <p>{apiErrorMessage(resources.error)}</p>
            <button type="button" onClick={() => void resources.refetch()}>
              Try again
            </button>
          </div>
        ) : items.length ? (
          <div className="resource-grid">
            {items.map((item) => (
              <ResourceCard key={item.id} resource={item} />
            ))}
          </div>
        ) : (
          <p>No published resources match these filters.</p>
        )}
        {resources.hasNextPage && (
          <button
            type="button"
            className="community-action"
            disabled={resources.isFetchingNextPage}
            onClick={() => void resources.fetchNextPage()}
          >
            Load more
          </button>
        )}
      </section>
      {moderator && <ResourceModerationPanel communityId={id} />}
    </div>
  );
}
