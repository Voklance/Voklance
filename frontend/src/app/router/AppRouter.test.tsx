// @vitest-environment jsdom
import type { AuthUser } from '@voklance/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '@/features/auth/api/authApi';
import { currentUserKey } from '@/features/auth/hooks/useCurrentUser';
import { profileApi } from '@/features/profiles/api/profileApi';
import { feedApi } from '@/features/feed/api/feedApi';
import { communityApi } from '@/features/communities/api/communityApi';
import { connectionApi } from '@/features/connections/api/connectionApi';
import { messagingApi } from '@/features/messaging/api/messagingApi';
import { notificationApi } from '@/features/notifications/api/notificationApi';
import { githubApi } from '@/features/github/api/githubApi';
import { recommendationApi } from '@/features/recommendations/api/recommendationApi';
import { bookmarkApi } from '@/features/bookmarks/api/bookmarkApi';
import { portfolioApi } from '@/features/profiles/api/portfolioApi';
import AppRouter from './AppRouter';

const fakeSocket = vi.hoisted(() => ({
  connected: true,
  on: vi.fn(),
  off: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn()
}));
vi.mock('@/lib/socketClient', () => ({
  messagingSocket: () => fakeSocket,
  currentConversation: () => null,
  setActiveConversation: vi.fn(),
  disconnectMessagingSocket: vi.fn()
}));
vi.mock('@/features/messaging/api/messagingApi', () => ({ messagingApi: { unreadCount: vi.fn() } }));
vi.mock('@/features/notifications/api/notificationApi', () => ({
  notificationApi: {
    list: vi.fn(),
    unread: vi.fn(),
    read: vi.fn(),
    readAll: vi.fn(),
    preferences: vi.fn(),
    savePreferences: vi.fn()
  }
}));
vi.mock('@/features/github/api/githubApi', () => ({
  githubApi: {
    connection: vi.fn(),
    featured: vi.fn(),
    portfolio: vi.fn(),
    repositories: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    sync: vi.fn(),
    saveFeatured: vi.fn()
  }
}));
vi.mock('@/features/recommendations/api/recommendationApi', () => ({
  recommendationApi: {
    feed: vi.fn(),
    recommendations: vi.fn(),
    feedback: vi.fn(),
    undoFeedback: vi.fn(),
    preferences: vi.fn(),
    savePreferences: vi.fn()
  }
}));
vi.mock('@/features/bookmarks/api/bookmarkApi', () => ({
  bookmarkApi: { saved: vi.fn(), collections: vi.fn(), activity: vi.fn() }
}));
vi.mock('@/features/profiles/api/portfolioApi', () => ({
  portfolioApi: { certifications: vi.fn(), projects: vi.fn(), completeness: vi.fn() }
}));

vi.mock('@/features/auth/api/authApi', () => ({
  authApi: { currentUser: vi.fn(), login: vi.fn(), signup: vi.fn(), logout: vi.fn() }
}));
vi.mock('@/features/onboarding/pages/OnboardingPage', () => ({
  default: () => <h1>Onboarding workspace</h1>
}));
vi.mock('@/features/profiles/api/profileApi', () => ({
  profileApi: {
    own: vi.fn(),
    skills: vi.fn(),
    interests: vi.fn(),
    experiences: vi.fn(),
    educations: vi.fn(),
    public: vi.fn()
  }
}));
vi.mock('@/features/feed/api/feedApi', () => ({ feedApi: { feed: vi.fn(), saved: vi.fn() } }));
vi.mock('@/features/communities/api/communityApi', () => ({
  communityApi: { discover: vi.fn(), mine: vi.fn() }
}));
vi.mock('@/features/connections/api/connectionApi', () => ({
  connectionApi: { counts: vi.fn(), mine: vi.fn(), professionals: vi.fn(), requests: vi.fn() }
}));

const incomplete: AuthUser = {
  id: 'a'.repeat(24),
  name: 'Sam Engineer',
  email: 'sam@example.test',
  accountStatus: 'ACTIVE',
  onboardingStatus: 'IN_PROGRESS',
  emailVerifiedAt: null,
  emailVerificationRequired: false
};
const completed: AuthUser = { ...incomplete, onboardingStatus: 'COMPLETED' };

function renderRoute(path: string, user?: AuthUser | null) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } }
  });
  if (user !== undefined) client.setQueryData(currentUserKey, user);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AppRouter />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authApi.currentUser).mockResolvedValue(null);
  vi.mocked(authApi.logout).mockResolvedValue(undefined);
  vi.mocked(profileApi.own).mockResolvedValue({ profile: null });
  vi.mocked(profileApi.skills).mockResolvedValue({ skills: [] });
  vi.mocked(profileApi.interests).mockResolvedValue({ interests: [] });
  vi.mocked(profileApi.experiences).mockResolvedValue({ experiences: [] });
  vi.mocked(profileApi.educations).mockResolvedValue({ educations: [] });
  vi.mocked(feedApi.feed).mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
  vi.mocked(feedApi.saved).mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
  vi.mocked(bookmarkApi.saved).mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
  vi.mocked(bookmarkApi.collections).mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
  vi.mocked(bookmarkApi.activity).mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
  vi.mocked(portfolioApi.certifications).mockResolvedValue({ items: [] });
  vi.mocked(portfolioApi.projects).mockResolvedValue({ items: [] });
  vi.mocked(portfolioApi.completeness).mockResolvedValue({
    percentage: 0,
    completedSections: [],
    suggestedSections: []
  });
  vi.mocked(communityApi.discover).mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
  vi.mocked(communityApi.mine).mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
  vi.mocked(connectionApi.counts).mockResolvedValue({ counts: { connections: 0, incoming: 0, sent: 0 } });
  vi.mocked(connectionApi.mine).mockResolvedValue({
    items: [],
    nextCursor: null,
    hasMore: false,
    counts: { connections: 0, incoming: 0, sent: 0 }
  });
  vi.mocked(connectionApi.professionals).mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
  vi.mocked(connectionApi.requests).mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
  vi.mocked(messagingApi.unreadCount).mockResolvedValue({ count: 0 });
  vi.mocked(notificationApi.unread).mockResolvedValue({ unreadCount: 0 });
  vi.mocked(notificationApi.list).mockResolvedValue({ items: [], hasMore: false, nextCursor: null });
  vi.mocked(githubApi.connection).mockResolvedValue({ connected: false });
  vi.mocked(githubApi.featured).mockResolvedValue({ connected: false, repositories: [] });
  vi.mocked(githubApi.portfolio).mockResolvedValue({ connected: false, repositories: [] });
  vi.mocked(recommendationApi.feed).mockResolvedValue({ items: [], hasMore: false, nextCursor: null });
  vi.mocked(recommendationApi.recommendations).mockResolvedValue({
    items: [],
    hasMore: false,
    nextCursor: null
  });
});
afterEach(cleanup);

describe('application access matrix', () => {
  it('opens the compact navigation, closes with Escape, and exposes a skip link', async () => {
    renderRoute('/app', completed);
    const toggle = await screen.findByRole('button', { name: 'Open menu' });
    expect(screen.getByRole('link', { name: 'Skip to main content' }).getAttribute('href')).toBe(
      '#main-content'
    );
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Close menu' }).getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Open menu' }).getAttribute('aria-expanded')).toBe('false');
  });
  it.each([
    ['/app', null, 'Welcome back.'],
    ['/onboarding', null, 'Welcome back.'],
    ['/signup', null, 'Join Voklance.'],
    ['/', null, 'Welcome back.'],
    ['/account', null, 'Welcome back.'],
    ['/app/profile', null, 'Welcome back.'],
    ['/app/professionals/ada-dev', null, 'Welcome back.'],
    ['/app', incomplete, 'Onboarding workspace'],
    ['/app/communities', incomplete, 'Onboarding workspace'],
    ['/login', incomplete, 'Onboarding workspace'],
    ['/signup', incomplete, 'Onboarding workspace'],
    ['/', incomplete, 'Onboarding workspace'],
    ['/account', incomplete, 'Onboarding workspace'],
    ['/app/profile', incomplete, 'Onboarding workspace'],
    ['/app/professionals/ada-dev', incomplete, 'Onboarding workspace'],
    ['/onboarding', incomplete, 'Onboarding workspace'],
    ['/login', completed, 'Professional feed'],
    ['/signup', completed, 'Professional feed'],
    ['/onboarding', completed, 'Professional feed'],
    ['/app', completed, 'Professional feed'],
    ['/app/saved', completed, 'Saved items'],
    ['/app/activity', completed, 'Your activity'],
    ['/app/communities', completed, 'Discover professional communities'],
    ['/app/profile', completed, 'Your profile'],
    ['/app/network', completed, 'My Network'],
    ['/app/network/discover', completed, 'Discover Professionals'],
    ['/', completed, 'Professional feed'],
    ['/account?communities', completed, 'Discover professional communities']
  ] as const)('%s routes correctly for %s', async (path, user, heading) => {
    renderRoute(path, user);
    expect(
      await screen.findByRole('heading', {
        name: heading,
        level: heading === 'Join Voklance.' || heading === 'Welcome back.' ? 2 : 1
      })
    ).toBeTruthy();
  });

  it('waits for the session lookup before rendering protected content', async () => {
    let resolve: (user: AuthUser | null) => void = () => {};
    vi.mocked(authApi.currentUser).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    renderRoute('/app');
    expect(screen.getByText('Checking your account…')).toBeTruthy();
    expect(screen.queryByText('Professional feed')).toBeNull();
    resolve(completed);
    expect(await screen.findByRole('heading', { name: 'Professional feed' })).toBeTruthy();
  });

  it('restores a completed session from the server after a fresh page load', async () => {
    vi.mocked(authApi.currentUser).mockResolvedValue(completed);
    renderRoute('/app');
    expect(await screen.findByRole('heading', { name: 'Professional feed' })).toBeTruthy();
    expect(authApi.currentUser).toHaveBeenCalledTimes(1);
  });

  it('shows retry on a network failure without treating the user as signed out', async () => {
    vi.mocked(authApi.currentUser).mockRejectedValue(new Error('Network unavailable'));
    renderRoute('/app');
    expect(
      await screen.findByText('We couldn’t check your account. Check your connection and try again.')
    ).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Welcome back.' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('offers sign-out for an account the server forbids', async () => {
    vi.mocked(authApi.currentUser).mockRejectedValue(
      Object.assign(new Error('Forbidden'), { isAxiosError: true, response: { status: 403 } })
    );
    renderRoute('/app');
    expect(await screen.findByRole('heading', { name: 'Account unavailable.' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
  });

  it('removes private caches when signing out', async () => {
    const client = renderRoute('/app', completed);
    client.setQueryData(['onboarding', 'progress'], { private: true });
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(client.getQueryData(currentUserKey)).toBeNull());
    expect(client.getQueryData(['onboarding', 'progress'])).toBeUndefined();
    expect(await screen.findByRole('heading', { name: 'Welcome back.' })).toBeTruthy();
  });
});
