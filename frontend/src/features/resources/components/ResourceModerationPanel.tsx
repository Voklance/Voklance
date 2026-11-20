import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { apiErrorMessage } from '@/lib/apiClient';
import { resourceApi } from '../api/resourceApi';
import { useResourceReports } from '../hooks/useResources';

export default function ResourceModerationPanel({ communityId }: { communityId: string }) {
  const client = useQueryClient();
  const query = useResourceReports(communityId, true);
  const review = useMutation({
    mutationFn: (value: { id: string; decision: 'hide' | 'dismiss' }) =>
      resourceApi.review(value.id, value.decision),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['resources'] });
      await client.invalidateQueries({ queryKey: ['communities', communityId, 'activities'] });
    }
  });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <section className="community-panel">
      <h2>Resource reports</h2>
      {query.isPending ? (
        <p role="status">Loading reports…</p>
      ) : query.isError ? (
        <p role="alert">{apiErrorMessage(query.error)}</p>
      ) : items.length ? (
        <ul className="resource-reports">
          {items.map((item) => (
            <li key={item.id}>
              <p>
                <Link to={`/app/resources/${item.resourceId}`}>Review resource</Link> · {item.reason}
              </p>
              {item.description && <p>{item.description}</p>}
              <div className="resource-actions">
                <button
                  type="button"
                  className="community-action"
                  disabled={review.isPending}
                  onClick={() => review.mutate({ id: item.id, decision: 'hide' })}
                >
                  Hide resource
                </button>
                <button
                  type="button"
                  className="community-action"
                  disabled={review.isPending}
                  onClick={() => review.mutate({ id: item.id, decision: 'dismiss' })}
                >
                  Dismiss report
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p>No pending reports.</p>
      )}
      {review.isError && <p role="alert">{apiErrorMessage(review.error)}</p>}
      {query.hasNextPage && (
        <button type="button" className="community-action" onClick={() => void query.fetchNextPage()}>
          Load more reports
        </button>
      )}
    </section>
  );
}
