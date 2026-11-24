import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { referralApi } from '../api/referralApi';

export const referralKeys = {
  opportunity: (id: string) => ['referrals', 'opportunity', id] as const,
  need: (id: string) => ['referrals', 'need', id] as const,
  responses: (kind: 'applications' | 'offers', id: string) => ['referrals', kind, id] as const,
  community: (kind: 'opportunities' | 'needs', id: string, status?: string) =>
    ['referrals', 'community', kind, id, status ?? 'all'] as const
};
const next = <T>(page: { hasMore: boolean; nextCursor: string | null; items: T[] }) =>
  page.hasMore ? (page.nextCursor ?? undefined) : undefined;
export function useOpportunity(id: string) {
  return useQuery({
    queryKey: referralKeys.opportunity(id),
    queryFn: () => referralApi.opportunity(id),
    enabled: !!id
  });
}
export function useNeed(id: string) {
  return useQuery({ queryKey: referralKeys.need(id), queryFn: () => referralApi.need(id), enabled: !!id });
}
export function useApplications(id: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: referralKeys.responses('applications', id),
    queryFn: ({ pageParam }) => referralApi.applications(id, pageParam),
    initialPageParam: '' as string,
    getNextPageParam: next,
    enabled
  });
}
export function useOffers(id: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: referralKeys.responses('offers', id),
    queryFn: ({ pageParam }) => referralApi.offers(id, pageParam),
    initialPageParam: '' as string,
    getNextPageParam: next,
    enabled
  });
}
export function useCommunityOpportunities(id: string, status?: string) {
  return useInfiniteQuery({
    queryKey: referralKeys.community('opportunities', id, status),
    queryFn: ({ pageParam }) => referralApi.communityOpportunities(id, pageParam, status),
    initialPageParam: '' as string,
    getNextPageParam: next,
    enabled: !!id
  });
}
export function useCommunityNeeds(id: string, status?: string) {
  return useInfiniteQuery({
    queryKey: referralKeys.community('needs', id, status),
    queryFn: ({ pageParam }) => referralApi.communityNeeds(id, pageParam, status),
    initialPageParam: '' as string,
    getNextPageParam: next,
    enabled: !!id
  });
}
export function useReferralActions() {
  const client = useQueryClient();
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['referrals'] }),
      client.invalidateQueries({ queryKey: ['communities'] })
    ]);
  };
  return {
    apply: useMutation({
      mutationFn: ({ id, input }: { id: string; input: Parameters<typeof referralApi.apply>[1] }) =>
        referralApi.apply(id, input),
      onSuccess: refresh
    }),
    offer: useMutation({
      mutationFn: ({ id, input }: { id: string; input: Parameters<typeof referralApi.offer>[1] }) =>
        referralApi.offer(id, input),
      onSuccess: refresh
    }),
    applicationStatus: useMutation({
      mutationFn: ({
        id,
        status
      }: {
        id: string;
        status: Parameters<typeof referralApi.applicationStatus>[1];
      }) => referralApi.applicationStatus(id, status),
      onSuccess: refresh
    }),
    offerStatus: useMutation({
      mutationFn: ({ id, status }: { id: string; status: Parameters<typeof referralApi.offerStatus>[1] }) =>
        referralApi.offerStatus(id, status),
      onSuccess: refresh
    }),
    updateOpportunity: useMutation({
      mutationFn: ({
        id,
        details
      }: {
        id: string;
        details: Parameters<typeof referralApi.updateOpportunity>[1];
      }) => referralApi.updateOpportunity(id, details),
      onSuccess: refresh
    }),
    updateNeed: useMutation({
      mutationFn: ({ id, details }: { id: string; details: Parameters<typeof referralApi.updateNeed>[1] }) =>
        referralApi.updateNeed(id, details),
      onSuccess: refresh
    }),
    closeOpportunity: useMutation({ mutationFn: referralApi.closeOpportunity, onSuccess: refresh }),
    closeNeed: useMutation({ mutationFn: referralApi.closeNeed, onSuccess: refresh }),
    fulfillNeed: useMutation({ mutationFn: referralApi.fulfillNeed, onSuccess: refresh })
  };
}
