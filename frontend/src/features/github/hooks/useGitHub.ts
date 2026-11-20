import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { githubApi } from '../api/githubApi';
export const githubKeys = {
  root: ['github'] as const,
  connection: ['github', 'connection'] as const,
  repositories: (search: string, language: string, sort: string) =>
    ['github', 'repositories', search, language, sort] as const,
  featured: ['github', 'featured'] as const,
  portfolio: (username: string) => ['github', 'portfolio', username] as const
};
export function useGitHubConnection() {
  return useQuery({ queryKey: githubKeys.connection, queryFn: githubApi.connection });
}
export function useGitHubRepositories(search: string, language: string, sort: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: githubKeys.repositories(search, language, sort),
    queryFn: ({ pageParam }) =>
      githubApi.repositories({ search, language, sort, cursor: pageParam || undefined }),
    initialPageParam: '' as string,
    getNextPageParam: (page) => (page.hasMore ? (page.nextCursor ?? undefined) : undefined),
    enabled
  });
}
export function useGitHubFeatured(enabled = true) {
  return useQuery({ queryKey: githubKeys.featured, queryFn: githubApi.featured, enabled });
}
export function useGitHubPortfolio(username: string, enabled = true) {
  return useQuery({
    queryKey: githubKeys.portfolio(username),
    queryFn: () => githubApi.portfolio(username),
    enabled: enabled && !!username
  });
}
