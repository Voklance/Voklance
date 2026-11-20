import type { ApiSuccess, SearchPage, SearchResult } from '@voklance/shared';
import { apiClient } from '@/lib/apiClient';
export type SearchFilters = {
  q: string;
  category: string;
  sort: string;
  location?: string;
  skill?: string;
  communityCategory?: string;
  eventType?: string;
  upcoming?: string;
  resourceCategory?: string;
  language?: string;
  featuredOnly?: string;
};
export const searchApi = {
  results: async (params: SearchFilters, cursor?: string) =>
    (await apiClient.get<ApiSuccess<SearchPage>>('/search', { params: { ...params, cursor, limit: 15 } }))
      .data.data,
  suggestions: async (q: string) =>
    (await apiClient.get<ApiSuccess<{ items: SearchResult[] }>>('/search/suggestions', { params: { q } }))
      .data.data.items
};
