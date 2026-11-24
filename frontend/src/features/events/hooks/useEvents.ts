import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RSVPResponse } from '@voklance/shared';
import { eventApi } from '../api/eventApi';
export function useCommunityEvents(communityId: string) {
  return useQuery({
    queryKey: ['events', 'community', communityId],
    queryFn: () => eventApi.community(communityId, { upcoming: true, limit: 6 }),
    enabled: !!communityId
  });
}
export function useEvent(eventId: string) {
  return useQuery({
    queryKey: ['events', eventId],
    queryFn: () => eventApi.detail(eventId),
    enabled: !!eventId
  });
}
export function useEventActions(eventId: string) {
  const client = useQueryClient();
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['events'] }),
      client.invalidateQueries({ queryKey: ['communities'] })
    ]);
  };
  return {
    edit: useMutation({
      mutationFn: (body: Record<string, unknown>) => eventApi.edit(eventId, body),
      onSuccess: refresh
    }),
    cancel: useMutation({ mutationFn: () => eventApi.cancel(eventId), onSuccess: refresh }),
    register: useMutation({ mutationFn: () => eventApi.register(eventId), onSuccess: refresh }),
    cancelRegistration: useMutation({
      mutationFn: () => eventApi.cancelRegistration(eventId),
      onSuccess: refresh
    }),
    rsvp: useMutation({
      mutationFn: (response: RSVPResponse) => eventApi.rsvp(eventId, response),
      onSuccess: refresh
    })
  };
}
export function useAttendees(eventId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['events', eventId, 'attendees'],
    queryFn: ({ pageParam }) => eventApi.attendees(eventId, pageParam || undefined),
    initialPageParam: '' as string,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled
  });
}
