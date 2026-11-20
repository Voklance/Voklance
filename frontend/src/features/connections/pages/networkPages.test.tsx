// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectionApi } from '../api/connectionApi';
import MyNetworkPage from './MyNetworkPage';
import ProfessionalDiscoveryPage from './ProfessionalDiscoveryPage';

vi.mock('../api/connectionApi', () => ({
  connectionApi: {
    professionals: vi.fn(),
    mine: vi.fn(),
    requests: vi.fn(),
    counts: vi.fn(),
    statusByUsername: vi.fn(),
    send: vi.fn(),
    accept: vi.fn(),
    decline: vi.fn(),
    cancel: vi.fn(),
    remove: vi.fn(),
    settings: vi.fn(),
    saveSettings: vi.fn()
  }
}));
const person = {
  userId: 'a'.repeat(24),
  username: 'ada-dev',
  fullName: 'Ada Developer',
  headline: 'Platform Engineer',
  city: 'Delhi',
  country: 'India',
  skills: ['TypeScript'],
  connectionStatus: 'none' as const,
  connectionCount: null
};
const pending = {
  id: 'b'.repeat(24),
  status: 'pending' as const,
  requesterId: 'c'.repeat(24),
  recipientId: person.userId,
  requestedAt: new Date().toISOString(),
  respondedAt: null,
  person
};
function show(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/app/network" element={<MyNetworkPage />} />
          <Route path="/app/network/discover" element={<ProfessionalDiscoveryPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return client;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(connectionApi.professionals).mockResolvedValue({
    items: [person],
    hasMore: false,
    nextCursor: null
  });
  vi.mocked(connectionApi.mine).mockResolvedValue({
    items: [],
    hasMore: false,
    nextCursor: null,
    counts: { connections: 0, incoming: 1, sent: 0 }
  });
  vi.mocked(connectionApi.requests).mockResolvedValue({ items: [pending], hasMore: false, nextCursor: null });
  vi.mocked(connectionApi.counts).mockResolvedValue({ counts: { connections: 0, incoming: 1, sent: 0 } });
  vi.mocked(connectionApi.send).mockResolvedValue({ connection: pending });
  vi.mocked(connectionApi.accept).mockResolvedValue({ connection: { ...pending, status: 'accepted' } });
  vi.mocked(connectionApi.decline).mockResolvedValue({ connection: { ...pending, status: 'declined' } });
  vi.mocked(connectionApi.cancel).mockResolvedValue({ connection: { ...pending, status: 'cancelled' } });
  vi.mocked(connectionApi.remove).mockResolvedValue({ connection: { ...pending, status: 'removed' } });
  vi.mocked(connectionApi.settings).mockResolvedValue({
    settings: {
      profileDiscoverable: true,
      allowConnectionRequests: true,
      connectionListVisibility: 'private'
    }
  });
  vi.mocked(connectionApi.saveSettings).mockImplementation(async (value) => ({
    settings: {
      profileDiscoverable: true,
      allowConnectionRequests: true,
      connectionListVisibility: 'private',
      ...value
    }
  }));
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true)
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('network pages', () => {
  it('discovers professionals and applies search, skill and location filters', async () => {
    show('/app/network/discover');
    expect(await screen.findByRole('heading', { name: 'Ada Developer' })).toBeTruthy();
    expect(screen.getByText('TypeScript')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search by name or headline'), { target: { value: 'Engineer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() =>
      expect(connectionApi.professionals).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'Engineer' }),
        ''
      )
    );
    fireEvent.change(screen.getByLabelText('Skill'), { target: { value: 'typescript' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() =>
      expect(connectionApi.professionals).toHaveBeenCalledWith(
        expect.objectContaining({ skill: 'typescript' }),
        ''
      )
    );
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Delhi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() =>
      expect(connectionApi.professionals).toHaveBeenCalledWith(
        expect.objectContaining({ location: 'Delhi' }),
        ''
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await waitFor(() =>
      expect(connectionApi.send).toHaveBeenCalledWith({ recipientId: person.userId }, expect.anything())
    );
  });
  it('shows loading, empty and error discovery states', async () => {
    vi.mocked(connectionApi.professionals).mockImplementationOnce(() => new Promise(() => undefined));
    show('/app/network/discover');
    expect(screen.getByText('Loading professionals…')).toBeTruthy();
    cleanup();
    vi.mocked(connectionApi.professionals).mockResolvedValueOnce({
      items: [],
      hasMore: false,
      nextCursor: null
    });
    show('/app/network/discover');
    expect(await screen.findByText('No professionals match these filters.')).toBeTruthy();
    cleanup();
    vi.mocked(connectionApi.professionals).mockRejectedValueOnce(new Error('offline'));
    show('/app/network/discover');
    expect(await screen.findByText('Professionals could not be loaded.')).toBeTruthy();
  });
  it('handles received, sent, and connection actions', async () => {
    show('/app/network?tab=incoming');
    expect(await screen.findByRole('heading', { name: 'Ada Developer' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(connectionApi.accept).toHaveBeenCalledWith(pending.id, expect.anything()));
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    await waitFor(() => expect(connectionApi.decline).toHaveBeenCalledWith(pending.id, expect.anything()));
    fireEvent.click(screen.getByRole('button', { name: 'Sent Requests' }));
    expect(await screen.findByRole('button', { name: 'Cancel request' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel request' }));
    await waitFor(() => expect(connectionApi.cancel).toHaveBeenCalledWith(pending.id, expect.anything()));
  });
  it('searches connections, removes a pair and saves privacy settings', async () => {
    vi.mocked(connectionApi.mine).mockResolvedValue({
      items: [{ ...pending, status: 'accepted' }],
      hasMore: false,
      nextCursor: null,
      counts: { connections: 1, incoming: 0, sent: 0 }
    });
    show('/app/network');
    expect(await screen.findByRole('button', { name: 'Remove connection' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search connections'), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(connectionApi.mine).toHaveBeenCalledWith('Ada', ''));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove connection' }));
    await waitFor(() => expect(connectionApi.remove).toHaveBeenCalledWith(pending.id, expect.anything()));
    fireEvent.click(screen.getByRole('button', { name: 'Privacy' }));
    expect(await screen.findByRole('heading', { name: 'Network privacy' })).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Allow connection requests'));
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() =>
      expect(connectionApi.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ allowConnectionRequests: false }),
        expect.anything()
      )
    );
  });
});
