// @vitest-environment jsdom
import type { AuthUser } from '@voklance/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppRouter from '@/app/router/AppRouter';
import { authApi } from '../api/authApi';
import { emailVerificationApi } from '../api/emailVerificationApi';
import { currentUserKey } from '../cache/authCache';
import { profileApi } from '@/features/profiles/api/profileApi';
import { feedApi } from '@/features/feed/api/feedApi';
import { communityApi } from '@/features/communities/api/communityApi';

vi.mock('../api/authApi', () => ({
  authApi: { currentUser: vi.fn(), login: vi.fn(), signup: vi.fn(), logout: vi.fn() }
}));
vi.mock('../api/emailVerificationApi', () => ({
  emailVerificationApi: { verify: vi.fn(), resend: vi.fn() }
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
    public: vi.fn(),
    ownRating: vi.fn()
  }
}));
vi.mock('@/features/feed/api/feedApi', () => ({ feedApi: { feed: vi.fn(), saved: vi.fn() } }));
vi.mock('@/features/communities/api/communityApi', () => ({
  communityApi: { discover: vi.fn(), mine: vi.fn() }
}));

const pending: AuthUser = {
  id: 'b'.repeat(24),
  name: 'New Member',
  email: 'new@example.test',
  accountStatus: 'ACTIVE',
  onboardingStatus: 'NOT_STARTED',
  emailVerifiedAt: null,
  emailVerificationRequired: true
};

function renderRoute(path: string, user: AuthUser | null = null) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } }
  });
  client.setQueryData(currentUserKey, user);
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
  vi.mocked(emailVerificationApi.resend).mockResolvedValue({ sent: true });
  vi.mocked(emailVerificationApi.verify).mockResolvedValue({ verified: true });
  vi.mocked(profileApi.own).mockResolvedValue({ profile: null });
  vi.mocked(profileApi.ownRating).mockResolvedValue({ average: null, count: 0 });
  vi.mocked(feedApi.feed).mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
  vi.mocked(communityApi.mine).mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
  window.history.replaceState(null, '', '/');
});
afterEach(cleanup);

describe('email verification pages and routes', () => {
  it('holds new users on the verification page after refresh and redirects other protected routes', () => {
    renderRoute('/app', pending);
    expect(screen.getByRole('heading', { name: 'Verify your email address' })).toBeTruthy();
    expect(screen.getByText('new@example.test')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeTruthy();
  });

  it('resends and shows a cooldown, then reports a failed resend', async () => {
    renderRoute('/verify-email-required', pending);
    fireEvent.click(screen.getByRole('button', { name: 'Resend verification email' }));
    expect(await screen.findByText(/Verification email accepted/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Resend available in/ })).toHaveProperty('disabled', true);
    expect(emailVerificationApi.resend).toHaveBeenCalledTimes(1);
  });

  it('rejects a missing link without calling the API', async () => {
    renderRoute('/verify-email');
    expect(await screen.findByRole('heading', { name: 'Verification link unavailable' })).toBeTruthy();
    expect(emailVerificationApi.verify).not.toHaveBeenCalled();
  });

  it('accepts a link while signed out and offers sign in without creating a session', async () => {
    window.history.replaceState(null, '', '/verify-email#token=abc123');
    renderRoute('/verify-email');
    expect(await screen.findByRole('heading', { name: 'Email verified' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeTruthy();
    expect(window.location.hash).toBe('');
    expect(emailVerificationApi.verify).toHaveBeenCalledWith('abc123');
  });

  it('refreshes the account and sends a verified signed-in user to onboarding', async () => {
    window.history.replaceState(null, '', '/verify-email#token=abc123');
    vi.mocked(authApi.currentUser).mockResolvedValue({
      ...pending,
      emailVerifiedAt: new Date().toISOString()
    });
    const client = renderRoute('/verify-email', pending);
    expect(await screen.findByRole('heading', { name: 'Onboarding workspace' })).toBeTruthy();
    expect(client.getQueryData<AuthUser>(currentUserKey)?.emailVerifiedAt).toBeTruthy();
  });

  it('shows invalid and network failures safely', async () => {
    window.history.replaceState(null, '', '/verify-email#token=abc123');
    vi.mocked(emailVerificationApi.verify).mockRejectedValue({ response: { status: 400 } });
    renderRoute('/verify-email');
    expect(await screen.findByRole('heading', { name: 'Verification link unavailable' })).toBeTruthy();
    cleanup();
    window.history.replaceState(null, '', '/verify-email#token=another');
    vi.mocked(emailVerificationApi.verify).mockRejectedValue(new Error('offline'));
    renderRoute('/verify-email');
    expect(await screen.findByRole('heading', { name: 'Could not verify your email' })).toBeTruthy();
  });

  it('explains when verification is switched off', async () => {
    window.history.replaceState(null, '', '/verify-email#token=abc123');
    vi.mocked(emailVerificationApi.verify).mockRejectedValue({
      response: { status: 503, data: { error: { code: 'EMAIL_VERIFICATION_DISABLED' } } }
    });
    renderRoute('/verify-email');
    expect(await screen.findByRole('heading', { name: 'Email verification is paused' })).toBeTruthy();
  });

  it('allows legacy accounts through their existing onboarding route', async () => {
    renderRoute('/app', { ...pending, emailVerificationRequired: false });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Onboarding workspace' })).toBeTruthy());
  });
});
