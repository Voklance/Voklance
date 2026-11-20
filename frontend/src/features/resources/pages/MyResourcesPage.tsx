import { Link } from 'react-router';
import { apiErrorMessage } from '@/lib/apiClient';
import ResourceCard from '../components/ResourceCard';
import { useMyResources, useResourceCapabilities } from '../hooks/useResources';

export default function MyResourcesPage() {
  const query = useMyResources();
  const capabilities = useResourceCapabilities();
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <div className="community-page resource-page">
      <header>
        <h1>My resources</h1>
        <p>Documents you have shared in communities you can access.</p>
      </header>
      {capabilities.data && !capabilities.data.uploadAvailable && (
        <p className="community-panel" role="status">
          Document upload and publication are unavailable until approved private storage and scanning are
          configured.
        </p>
      )}
      {query.isPending ? (
        <p role="status">Loading your resources…</p>
      ) : query.isError ? (
        <div role="alert">
          <p>{apiErrorMessage(query.error)}</p>
          <button type="button" onClick={() => void query.refetch()}>
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
        <div className="community-panel">
          <p>You have not shared any resources yet.</p>
          <Link to="/app/communities">Browse communities</Link>
        </div>
      )}
      {query.hasNextPage && (
        <button
          type="button"
          className="community-action"
          onClick={() => void query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
        >
          Load more
        </button>
      )}
    </div>
  );
}
