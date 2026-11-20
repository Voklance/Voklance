import type {
  ApiSuccess,
  FeedMode,
  FeedPreferences,
  RecommendedFeedPage,
  RecommendationCategory,
  RecommendationPage
} from '@voklance/shared';
import { apiClient } from '@/lib/apiClient';
const data = async <T>(request: Promise<{ data: ApiSuccess<T> }>): Promise<T> => (await request).data.data;
export const recommendationApi = {
  feed: (mode: FeedMode, cursor?: string) =>
    data<RecommendedFeedPage>(apiClient.get(`/feed/${mode}`, { params: { limit: 10, cursor } })),
  recommendations: (category: RecommendationCategory, cursor?: string, limit = 12) =>
    data<RecommendationPage>(apiClient.get(`/recommendations/${category}`, { params: { limit, cursor } })),
  preferences: () => data<{ preferences: FeedPreferences }>(apiClient.get('/recommendations/preferences')),
  savePreferences: (topics: string[]) =>
    data<{ preferences: FeedPreferences }>(apiClient.patch('/recommendations/preferences', { topics })),
  feedback: (
    entityType: 'post' | RecommendationCategory,
    entityId: string,
    action: 'hidden' | 'not_interested' | 'dismissed'
  ) => data<{ id: string }>(apiClient.post('/recommendations/feedback', { entityType, entityId, action })),
  undoFeedback: (id: string) =>
    data<{ removed: boolean }>(apiClient.delete(`/recommendations/feedback/${id}`))
};
