import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { connectionApi, type DiscoveryFilters } from '../api/connectionApi';

export const networkKeys = {
  root: ['network'] as const,
  professionals: (filters: DiscoveryFilters) => ['network', 'professionals', filters] as const,
  mine: (search?: string) => ['network', 'connections', 'me', search ?? ''] as const,
  requests: (direction: 'incoming' | 'sent') => ['network', 'requests', direction] as const,
  status: (key: string) => ['network', 'status', key] as const,
  counts: ['network', 'counts'] as const,
  settings: ['network', 'settings'] as const
};
const next = (page: { hasMore: boolean; nextCursor: string | null }) =>
  page.hasMore ? (page.nextCursor ?? undefined) : undefined;
export function useProfessionals(filters: DiscoveryFilters) {
  return useInfiniteQuery({
    queryKey: networkKeys.professionals(filters),
    queryFn: ({ pageParam }) => connectionApi.professionals(filters, pageParam),
    initialPageParam: '' as string,
    getNextPageParam: next
  });
}
export function useMyConnections(search?: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: networkKeys.mine(search),
    queryFn: ({ pageParam }) => connectionApi.mine(search, pageParam),
    initialPageParam: '' as string,
    getNextPageParam: next,
    enabled
  });
}
export function useRequests(direction: 'incoming' | 'sent', enabled = true) {
  return useInfiniteQuery({
    queryKey: networkKeys.requests(direction),
    queryFn: ({ pageParam }) => connectionApi.requests(direction, pageParam),
    initialPageParam: '' as string,
    getNextPageParam: next,
    enabled
  });
}
export function useNetworkCounts() {
  return useQuery({ queryKey: networkKeys.counts, queryFn: connectionApi.counts, staleTime: 30_000 });
}
export function useConnectionStatus(username: string) {
  return useQuery({
    queryKey: networkKeys.status(`username:${username}`),
    queryFn: () => connectionApi.statusByUsername(username),
    enabled: !!username
  });
}
export function useVisibleConnections(username: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['network', 'visible', username],
    queryFn: ({ pageParam }) => connectionApi.visible(username, pageParam),
    initialPageParam: '' as string,
    getNextPageParam: next,
    enabled
  });
}
export function useNetworkSettings(enabled = true) {
  return useQuery({ queryKey: networkKeys.settings, queryFn: connectionApi.settings, enabled });
}
export function useNetworkActions() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: networkKeys.root });
  return {
    send: useMutation({ mutationFn: connectionApi.send, onSuccess: refresh }),
    accept: useMutation({ mutationFn: connectionApi.accept, onSuccess: refresh }),
    decline: useMutation({ mutationFn: connectionApi.decline, onSuccess: refresh }),
    cancel: useMutation({ mutationFn: connectionApi.cancel, onSuccess: refresh }),
    remove: useMutation({ mutationFn: connectionApi.remove, onSuccess: refresh }),
    settings: useMutation({ mutationFn: connectionApi.saveSettings, onSuccess: refresh })
  };
}
