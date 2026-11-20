import type { FeedPost } from './index.js';
import type { SearchResult, SearchResultCategory } from './search.js';
export const FEED_MODES = ['for-you', 'following', 'recent'] as const;
export type FeedMode = (typeof FEED_MODES)[number];
export const RECOMMENDATION_CATEGORIES = [
  'people',
  'communities',
  'events',
  'resources',
  'referrals'
] as const;
export type RecommendationCategory = (typeof RECOMMENDATION_CATEGORIES)[number];
export const RECOMMENDATION_FEEDBACK_ACTIONS = ['not_interested', 'hidden', 'dismissed'] as const;
export type RecommendationFeedbackAction = (typeof RECOMMENDATION_FEEDBACK_ACTIONS)[number];
export interface RecommendedPost extends FeedPost {
  reason: string;
}
export interface RecommendedFeedPage {
  items: RecommendedPost[];
  hasMore: boolean;
  nextCursor: string | null;
}
export interface RecommendationResult extends SearchResult {
  category: Extract<SearchResultCategory, RecommendationCategory>;
  reason: string;
}
export interface RecommendationPage {
  items: RecommendationResult[];
  hasMore: boolean;
  nextCursor: string | null;
}
export interface FeedPreferences {
  topics: string[];
}
