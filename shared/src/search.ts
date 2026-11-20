export const SEARCH_CATEGORIES = [
  'all',
  'people',
  'communities',
  'posts',
  'events',
  'referrals',
  'resources',
  'github'
] as const;
export type SearchCategory = (typeof SEARCH_CATEGORIES)[number];
export type SearchResultCategory = Exclude<SearchCategory, 'all'>;
export interface SearchResult {
  id: string;
  category: SearchResultCategory;
  title: string;
  description: string;
  href: string;
  imageUrl: string | null;
  relevanceScore: number;
  createdAt: string;
  metadata: Record<string, string | number | boolean | null>;
}
export interface SearchPage {
  category: SearchCategory;
  items: SearchResult[];
  hasMore: boolean;
  nextCursor: string | null;
  previews?: Partial<Record<SearchResultCategory, SearchResult[]>>;
}
