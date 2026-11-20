// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { settingsApi } from './api/settingsApi';
import SettingsOverviewPage from './pages/SettingsOverviewPage';
import PrivacySettingsPage from './pages/PrivacySettingsPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
vi.mock('./api/settingsApi', () => ({
  settingsApi: { privacy: vi.fn(), updatePrivacy: vi.fn(), resetPassword: vi.fn() }
}));
function renderPage(element: React.ReactNode) {
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
  vi.mocked(settingsApi.privacy).mockResolvedValue({
    settings: {
      visibility: 'PRIVATE',
      profileDiscoverable: true,
      allowConnectionRequests: true,
      connectionListVisibility: 'private',
      allowDirectMessages: true,
      showReadReceipts: false,
      showOnlineStatus: true
    }
  });
  vi.mocked(settingsApi.updatePrivacy).mockImplementation(async (settings) => ({
    settings: {
      visibility: 'PRIVATE',
      profileDiscoverable: true,
      allowConnectionRequests: true,
      connectionListVisibility: 'private',
      allowDirectMessages: true,
      showReadReceipts: false,
      showOnlineStatus: true,
      ...settings
    }
  }));
});
afterEach(cleanup);
describe('account settings UI', () => {
  it('links all settings sections and saves a privacy choice', async () => {
    renderPage(
      <>
        <SettingsOverviewPage />
        <PrivacySettingsPage />
      </>
    );
    expect(screen.getByRole('link', { name: /Security/ }).getAttribute('href')).toBe(
      '/app/settings/security'
    );
    const discoverable = await screen.findByRole('checkbox', { name: 'Show me in professional discovery' });
    fireEvent.click(discoverable);
    fireEvent.click(screen.getByRole('button', { name: 'Save privacy choices' }));
    await waitFor(() =>
      expect(settingsApi.updatePrivacy).toHaveBeenCalledWith(
        expect.objectContaining({ profileDiscoverable: false }),
        expect.anything()
      )
    );
  });
  it('removes the reset token from the URL and submits matching passwords', async () => {
    const token = 'a'.repeat(43);
    window.history.replaceState({}, '', `/reset-password#token=${token}`);
    vi.mocked(settingsApi.resetPassword).mockResolvedValue({ reset: true });
    renderPage(<ResetPasswordPage />);
    expect(window.location.hash).toBe('');
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'long-secure-password' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'long-secure-password' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));
    await waitFor(() =>
      expect(settingsApi.resetPassword).toHaveBeenCalledWith(
        token,
        'long-secure-password',
        'long-secure-password'
      )
    );
    expect(await screen.findByText('Password reset. Sign in with your new password.')).toBeTruthy();
  });
});
