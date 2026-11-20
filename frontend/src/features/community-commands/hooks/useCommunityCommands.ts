import type { CommandId, CommandSubmission } from '@voklance/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { commandApi } from '../api/commandApi';

export const commandKeys = {
  commands: (communityId: string) => ['communities', communityId, 'commands'] as const,
  activities: (communityId: string, command?: CommandId) =>
    ['communities', communityId, 'activities', command ?? 'all'] as const
};
export function useCommunityCommands(communityId: string, enabled: boolean) {
  return useQuery({
    queryKey: commandKeys.commands(communityId),
    queryFn: () => commandApi.commands(communityId),
    enabled: !!communityId && enabled
  });
}
export function useCommunityActivities(
  communityId: string,
  command: CommandId | undefined,
  enabled: boolean
) {
  return useInfiniteQuery({
    queryKey: commandKeys.activities(communityId, command),
    queryFn: ({ pageParam }) => commandApi.activities(communityId, command, pageParam),
    initialPageParam: '' as string,
    getNextPageParam: (page) => (page.hasMore ? (page.nextCursor ?? undefined) : undefined),
    enabled: !!communityId && enabled
  });
}
export function useCommandActions(communityId: string) {
  const client = useQueryClient();
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['communities', communityId, 'activities'] }),
      client.invalidateQueries({ queryKey: ['referrals'] }),
      client.invalidateQueries({ queryKey: ['events'] })
    ]);
  };
  return {
    submit: useMutation({
      mutationFn: (input: CommandSubmission) => commandApi.submit(communityId, input),
      onSuccess: refresh
    }),
    remove: useMutation({
      mutationFn: (activityId: string) => commandApi.remove(communityId, activityId),
      onSuccess: refresh
    })
  };
}
