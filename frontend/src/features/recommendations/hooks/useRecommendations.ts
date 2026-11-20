import type { FeedMode, RecommendationCategory } from '@voklance/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { recommendationApi } from '../api/recommendationApi';
export const recommendationKeys = {
  feed: (mode: FeedMode) => ['recommended-feed', mode] as const,
  category: (category: RecommendationCategory) => ['recommendations', category] as const,
  preferences: ['recommendations', 'preferences'] as const
};
export function useRecommendedFeed(mode: FeedMode) {
  return useInfiniteQuery({
    queryKey: recommendationKeys.feed(mode),
    queryFn: ({ pageParam }) => recommendationApi.feed(mode, pageParam || undefined),
    initialPageParam: '' as string,
    getNextPageParam: (page) => (page.hasMore ? (page.nextCursor ?? undefined) : undefined)
  });
}
export function useRecommendationCategory(category: RecommendationCategory, limit = 12) {
  return useInfiniteQuery({
    queryKey: recommendationKeys.category(category),
    queryFn: ({ pageParam }) => recommendationApi.recommendations(category, pageParam || undefined, limit),
    initialPageParam: '' as string,
    getNextPageParam: (page) => (page.hasMore ? (page.nextCursor ?? undefined) : undefined)
  });
}
export function useFeedPreferences() {
  return useQuery({ queryKey: recommendationKeys.preferences, queryFn: recommendationApi.preferences });
}
export function useRecommendationActions() {
  const client = useQueryClient();
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ['recommended-feed'] }),
      client.invalidateQueries({ queryKey: ['recommendations'] })
    ]);
  return {
    feedback: useMutation({
      mutationFn: (input: Parameters<typeof recommendationApi.feedback>) =>
        recommendationApi.feedback(...input),
      onSuccess: refresh
    }),
    undoFeedback: useMutation({ mutationFn: recommendationApi.undoFeedback, onSuccess: refresh }),
    savePreferences: useMutation({ mutationFn: recommendationApi.savePreferences, onSuccess: refresh })
  };
}
