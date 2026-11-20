import type { BookmarkType } from '@voklance/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bookmarkApi } from '../api/bookmarkApi';
import { apiErrorMessage } from '@/lib/apiClient';

export default function BookmarkButton({ type, entityId }: { type: BookmarkType; entityId: string }) {
  const client = useQueryClient();
  const key = ['bookmark-status', type, entityId];
  const status = useQuery({
    queryKey: key,
    queryFn: () => bookmarkApi.status(type, entityId),
    enabled: !!entityId
  });
  const record = status.data?.items[0];
  const update = useMutation({
    mutationFn: async () => {
      if (record) await bookmarkApi.remove(record.id);
      else await bookmarkApi.save(type, entityId);
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: key }),
        client.invalidateQueries({ queryKey: ['saved-items'] }),
        client.invalidateQueries({ queryKey: ['feed'] }),
        client.invalidateQueries({ queryKey: ['recommended-feed'] })
      ]);
    }
  });
  return (
    <div className="bookmark-control">
      <button
        className="community-action"
        type="button"
        aria-pressed={!!record}
        disabled={status.isPending || update.isPending || status.isError}
        onClick={() => update.mutate()}
      >
        <span aria-hidden="true">🔖</span>{' '}
        {update.isPending ? 'Updating…' : record ? 'Remove from saved' : 'Save for later'}
      </button>
      {status.isError && <span role="alert">Save status unavailable.</span>}
      {update.isError && <span role="alert">{apiErrorMessage(update.error)}</span>}
    </div>
  );
}
