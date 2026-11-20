// @vitest-environment jsdom
import type { GitHubRepositoryDto } from '@voklance/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { githubApi } from './api/githubApi';
import GitHubPortfolioPanel from './components/GitHubPortfolioPanel';
import GitHubPage from './pages/GitHubPage';
vi.mock('./api/githubApi', () => ({
  githubApi: {
    connection: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    sync: vi.fn(),
    repositories: vi.fn(),
    featured: vi.fn(),
    saveFeatured: vi.fn(),
    portfolio: vi.fn()
  }
}));
const repository: GitHubRepositoryDto = {
  id: 'a'.repeat(24),
  githubRepositoryId: '100',
  name: 'sample',
  fullName: 'dev-user/sample',
  description: 'A public project',
  htmlUrl: 'https://github.com/dev-user/sample',
  primaryLanguage: 'TypeScript',
  topics: ['typescript'],
  stargazersCount: 5,
  forksCount: 2,
  watchersCount: 5,
  isFork: false,
  isArchived: false,
  pushedAt: null,
  githubUpdatedAt: new Date().toISOString(),
  featuredOrder: null,
  lastSyncedAt: new Date().toISOString()
};
function show(element: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{element}</MemoryRouter>
    </QueryClientProvider>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true)
  );
  vi.mocked(githubApi.connection).mockResolvedValue({
    connected: true,
    username: 'dev-user',
    profileUrl: 'https://github.com/dev-user',
    syncStatus: 'success',
    repositoryCount: 1,
    lastSyncedAt: null
  });
  vi.mocked(githubApi.repositories).mockResolvedValue({
    items: [repository],
    hasMore: false,
    nextCursor: null
  });
  vi.mocked(githubApi.featured).mockResolvedValue({
    connected: true,
    username: 'dev-user',
    profileUrl: 'https://github.com/dev-user',
    repositories: []
  });
  vi.mocked(githubApi.saveFeatured).mockResolvedValue({
    connected: true,
    repositories: [{ ...repository, featuredOrder: 0 }]
  });
  vi.mocked(githubApi.sync).mockResolvedValue({
    syncStatus: 'success',
    importedCount: 1,
    lastSyncedAt: new Date().toISOString()
  });
  vi.mocked(githubApi.disconnect).mockResolvedValue({ connected: false });
  vi.mocked(githubApi.portfolio).mockResolvedValue({
    connected: true,
    username: 'dev-user',
    profileUrl: 'https://github.com/dev-user',
    repositories: [{ ...repository, featuredOrder: 0 }]
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe('GitHub portfolio UI', () => {
  it('syncs, selects featured projects, and disconnects', async () => {
    show(<GitHubPage />);
    expect(await screen.findByText('Connected as', { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sync public repositories' }));
    await waitFor(() => expect(githubApi.sync).toHaveBeenCalled());
    fireEvent.click(await screen.findByLabelText('Feature sample'));
    fireEvent.click(screen.getByRole('button', { name: 'Save featured projects' }));
    await waitFor(() =>
      expect(githubApi.saveFeatured).toHaveBeenCalledWith([repository.id], expect.any(Object))
    );
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    await waitFor(() => expect(githubApi.disconnect).toHaveBeenCalled());
  });
  it('renders only server-approved featured public metadata', async () => {
    show(<GitHubPortfolioPanel username="dev-user" />);
    expect(await screen.findByRole('heading', { name: 'Featured GitHub projects' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'sample' }).getAttribute('href')).toBe(repository.htmlUrl);
    expect(screen.getByText('A public project')).toBeTruthy();
  });
});
