export interface GitHubConnectionDto {
  connected: boolean;
  username?: string;
  profileUrl?: string;
  avatarUrl?: string | null;
  connectedAt?: string;
  lastSyncedAt?: string | null;
  syncStatus?: 'never' | 'syncing' | 'success' | 'partial' | 'error';
  repositoryCount?: number;
}
export interface GitHubRepositoryDto {
  id: string;
  githubRepositoryId: string;
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  primaryLanguage: string | null;
  topics: string[];
  stargazersCount: number;
  forksCount: number;
  watchersCount: number;
  isFork: boolean;
  isArchived: boolean;
  pushedAt: string | null;
  githubUpdatedAt: string;
  featuredOrder: number | null;
  lastSyncedAt: string;
}
export interface GitHubRepositoryPage {
  items: GitHubRepositoryDto[];
  nextCursor: string | null;
  hasMore: boolean;
}
