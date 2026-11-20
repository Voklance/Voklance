export const BOOKMARK_TYPES = ['post', 'resource', 'event', 'referral'] as const;
export type BookmarkType = (typeof BOOKMARK_TYPES)[number];
export interface SavedItem {
  id: string;
  entityType: BookmarkType;
  entityId: string;
  savedAt: string;
  available: boolean;
  title: string | null;
  description: string | null;
  href: string | null;
  metadata: Record<string, string | number | null>;
  collectionIds: string[];
}
export interface SavedItemPage {
  items: SavedItem[];
  hasMore: boolean;
  nextCursor: string | null;
}
export interface BookmarkCollectionDto {
  id: string;
  name: string;
  description: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}
export interface BookmarkCollectionPage {
  items: BookmarkCollectionDto[];
  hasMore: boolean;
  nextCursor: string | null;
}
export const ACTIVITY_TYPES = [
  'post',
  'comment',
  'like',
  'connection',
  'membership',
  'event',
  'resource',
  'referral'
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export interface ActivityItem {
  id: string;
  type: ActivityType;
  action: string;
  createdAt: string;
  href: string | null;
  title: string;
}
export interface PersonalActivityPage {
  items: ActivityItem[];
  hasMore: boolean;
  nextCursor: string | null;
}
