import type {
  ApiSuccess,
  GitHubConnectionDto,
  GitHubRepositoryPage,
  GitHubRepositoryDto
} from '@voklance/shared';
import { apiClient } from '@/lib/apiClient';
const data = async <T>(request: Promise<{ data: ApiSuccess<T> }>): Promise<T> => (await request).data.data;
export interface GitHubPortfolio {
  connected: boolean;
  username?: string;
  profileUrl?: string;
  repositories: GitHubRepositoryDto[];
}
export const githubApi = {
  connection: () => data<GitHubConnectionDto>(apiClient.get('/github/connection')),
  connect: () => data<{ authorizationUrl: string }>(apiClient.get('/github/connect')),
  disconnect: () => data<{ connected: boolean }>(apiClient.delete('/github/connection')),
  sync: () =>
    data<{ syncStatus: 'success' | 'partial'; importedCount: number; lastSyncedAt: string }>(
      apiClient.post('/github/sync')
    ),
  repositories: (params: { search?: string; language?: string; sort?: string; cursor?: string }) =>
    data<GitHubRepositoryPage>(apiClient.get('/github/repositories', { params: { ...params, limit: 20 } })),
  featured: () => data<GitHubPortfolio>(apiClient.get('/github/featured')),
  saveFeatured: (repositoryIds: string[]) =>
    data<GitHubPortfolio>(apiClient.put('/github/featured', { repositoryIds })),
  portfolio: (username: string) =>
    data<GitHubPortfolio>(apiClient.get(`/github/portfolio/${encodeURIComponent(username)}`))
};
