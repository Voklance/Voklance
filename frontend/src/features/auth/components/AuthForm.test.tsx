// @vitest-environment jsdom
import type { AuthUser } from '@voklance/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '../api/authApi';
import { currentUserKey } from '../hooks/useCurrentUser';
import AuthForm from './AuthForm';

vi.mock('../api/authApi', () => ({
  authApi: { login: vi.fn(), signup: vi.fn(), currentUser: vi.fn(), logout: vi.fn() }
}));
const account: AuthUser = {
  id: 'a'.repeat(24),
  name: 'Sam Engineer',
  email: 'sam@example.test',
  accountStatus: 'ACTIVE',
  onboardingStatus: 'NOT_STARTED',
  emailVerifiedAt: null,
  emailVerificationRequired: false
};

function renderForm(mode: 'login' | 'signup') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/${mode}`]}>
        <Routes>
          <Route path="/login" element={<AuthForm mode="login" />} />
          <Route path="/signup" element={<AuthForm mode="signup" />} />
          <Route path="/onboarding" element={<h1>Onboarding workspace</h1>} />
          <Route path="/verify-email-required" element={<h1>Verification required</h1>} />
          <Route path="/app" element={<h1>Application home</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return client;
}

function enterCredentials(mode: 'login' | 'signup') {
  if (mode === 'signup')
    fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: 'Sam Engineer' } });
  fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: 'sam@example.test' } });
  fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'password-123' } });
  if (mode === 'signup')
    fireEvent.change(screen.getByLabelText(/Confirm password/), { target: { value: 'password-123' } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authApi.login).mockResolvedValue(account);
  vi.mocked(authApi.signup).mockResolvedValue({ user: account, verificationEmailSent: true });
  vi.mocked(authApi.currentUser).mockResolvedValue(account);
});
afterEach(cleanup);

describe('auth form', () => {
  it('shows sign-up fields and blocks incomplete registration', () => {
    renderForm('signup');
    expect(screen.getByRole('heading', { name: 'Join Voklance.' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
    expect(authApi.signup).not.toHaveBeenCalled();
  });

  it('uses refreshed current-user status to send incomplete logins to onboarding', async () => {
    const client = renderForm('login');
    client.setQueryData(['onboarding', 'progress'], { oldAccount: true });
    enterCredentials('login');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Onboarding workspace' })).toBeTruthy();
    expect(authApi.currentUser).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(['onboarding', 'progress'])).toBeUndefined();
    expect(client.getQueryData<AuthUser>(currentUserKey)?.onboardingStatus).toBe('NOT_STARTED');
  });

  it('sends completed logins to the application', async () => {
    vi.mocked(authApi.currentUser).mockResolvedValue({ ...account, onboardingStatus: 'COMPLETED' });
    renderForm('login');
    enterCredentials('login');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Application home' })).toBeTruthy();
  });

  it('sends new signups to onboarding after confirming the session', async () => {
    renderForm('signup');
    enterCredentials('signup');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('heading', { name: 'Onboarding workspace' })).toBeTruthy();
    expect(authApi.signup).toHaveBeenCalledTimes(1);
  });

  it('sends new unverified signups to verification after confirming the session', async () => {
    vi.mocked(authApi.currentUser).mockResolvedValue({ ...account, emailVerificationRequired: true });
    renderForm('signup');
    enterCredentials('signup');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('heading', { name: 'Verification required' })).toBeTruthy();
  });

  it('keeps the form visible when server confirmation fails', async () => {
    vi.mocked(authApi.currentUser).mockRejectedValue(new Error('Connection lost'));
    renderForm('login');
    enterCredentials('login');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.queryByRole('heading', { name: 'Application home' })).toBeNull();
  });
});
