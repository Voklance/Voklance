import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { resourceApi, type ResourceFilters } from '../api/resourceApi';

export const resourceKeys = {
  community: (id: string, filters: Omit<ResourceFilters, 'cursor'>) =>
    ['resources', 'community', id, filters] as const,
  detail: (id: string) => ['resources', id] as const,
  reports: (id: string) => ['resources', 'reports', id] as const
};
export function useCommunityResources(id: string, filters: Omit<ResourceFilters, 'cursor'>) {
  return useInfiniteQuery({
    queryKey: resourceKeys.community(id, filters),
    queryFn: ({ pageParam }) => resourceApi.community(id, { ...filters, cursor: pageParam || undefined }),
    initialPageParam: '' as string,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: !!id
  });
}
export function useResource(id: string) {
  return useQuery({
    queryKey: resourceKeys.detail(id),
    queryFn: () => resourceApi.detail(id),
    enabled: !!id
  });
}
export function useResourceReports(communityId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: resourceKeys.reports(communityId),
    queryFn: ({ pageParam }) => resourceApi.reports(communityId, pageParam || undefined),
    initialPageParam: '' as string,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled
  });
}
export function useResourceActions(id: string) {
  const client = useQueryClient();
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['resources'] }),
      client.invalidateQueries({ queryKey: ['communities'] })
    ]);
  };
  return {
    edit: useMutation({
      mutationFn: (body: Record<string, unknown>) => resourceApi.edit(id, body),
      onSuccess: refresh
    }),
    remove: useMutation({ mutationFn: () => resourceApi.remove(id), onSuccess: refresh }),
    report: useMutation({
      mutationFn: (value: { reason: string; description?: string }) =>
        resourceApi.report(id, value.reason, value.description),
      onSuccess: refresh
    }),
    review: useMutation({
      mutationFn: (value: { reportId: string; decision: 'hide' | 'dismiss' }) =>
        resourceApi.review(value.reportId, value.decision),
      onSuccess: refresh
    })
  };
}
