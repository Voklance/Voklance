import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { communityApi, type CommunityFilters } from '../api/communityApi';

export const communityKeys = {
  root: ['communities'] as const,
  discover: (filters: CommunityFilters) => ['communities', 'discover', filters] as const,
  mine: ['communities', 'mine'] as const,
  detail: (slug: string) => ['communities', 'detail', slug] as const,
  members: (id: string) => ['communities', id, 'members'] as const,
  requests: (id: string) => ['communities', id, 'requests'] as const
};
const next = (page: { hasMore: boolean; nextCursor: string | null }) =>
  page.hasMore ? (page.nextCursor ?? undefined) : undefined;
export function useCommunities(filters: CommunityFilters) {
  return useInfiniteQuery({
    queryKey: communityKeys.discover(filters),
    queryFn: ({ pageParam }) => communityApi.discover(filters, pageParam),
    initialPageParam: '' as string,
    getNextPageParam: next
  });
}
export function useMyCommunities() {
  return useInfiniteQuery({
    queryKey: communityKeys.mine,
    queryFn: ({ pageParam }) => communityApi.mine(pageParam),
    initialPageParam: '' as string,
    getNextPageParam: next
  });
}
export function useCommunity(slug: string) {
  return useQuery({
    queryKey: communityKeys.detail(slug),
    queryFn: () => communityApi.detail(slug),
    enabled: !!slug
  });
}
export function useCommunityMembers(id: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: communityKeys.members(id),
    queryFn: ({ pageParam }) => communityApi.members(id, pageParam),
    initialPageParam: '' as string,
    getNextPageParam: next,
    enabled: !!id && enabled
  });
}
export function useMembershipRequests(id: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: communityKeys.requests(id),
    queryFn: ({ pageParam }) => communityApi.requests(id, pageParam),
    initialPageParam: '' as string,
    getNextPageParam: next,
    enabled: !!id && enabled
  });
}
export function useCommunityActions() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: communityKeys.root });
  return {
    create: useMutation({ mutationFn: communityApi.create, onSuccess: refresh }),
    join: useMutation({ mutationFn: communityApi.join, onSuccess: refresh }),
    leave: useMutation({ mutationFn: communityApi.leave, onSuccess: refresh }),
    decide: useMutation({
      mutationFn: ({ id, requestId, approve }: { id: string; requestId: string; approve: boolean }) =>
        communityApi.decide(id, requestId, approve),
      onSuccess: refresh
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: Parameters<typeof communityApi.update>[1] }) =>
        communityApi.update(id, input),
      onSuccess: refresh
    }),
    role: useMutation({
      mutationFn: ({
        id,
        userId,
        role
      }: {
        id: string;
        userId: string;
        role: 'ADMIN' | 'MODERATOR' | 'MEMBER';
      }) => communityApi.role(id, userId, role),
      onSuccess: refresh
    }),
    remove: useMutation({
      mutationFn: ({ id, userId }: { id: string; userId: string }) => communityApi.remove(id, userId),
      onSuccess: refresh
    }),
    transfer: useMutation({
      mutationFn: ({ id, newOwnerUserId }: { id: string; newOwnerUserId: string }) =>
        communityApi.transfer(id, newOwnerUserId),
      onSuccess: refresh
    }),
    archive: useMutation({ mutationFn: communityApi.archive, onSuccess: refresh })
  };
}
