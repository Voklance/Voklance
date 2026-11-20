// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { bookmarkApi } from '../api/bookmarkApi';
import SavedItemsPage from './SavedItemsPage';
import ActivityPage from './ActivityPage';

vi.mock('../api/bookmarkApi', () => ({
  bookmarkApi: {
    saved: vi.fn(),
    collections: vi.fn(),
    activity: vi.fn(),
    remove: vi.fn(),
    createCollection: vi.fn(),
    addToCollection: vi.fn(),
    removeFromCollection: vi.fn()
  }
}));
function renderPage(element: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{element}</MemoryRouter>
    </QueryClientProvider>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(bookmarkApi.saved).mockResolvedValue({
    items: [
      {
        id: 'a'.repeat(24),
        entityType: 'post',
        entityId: 'b'.repeat(24),
        savedAt: '2025-01-01T00:00:00.000Z',
        available: true,
        title: 'Useful article',
        description: 'A useful engineering post.',
        href: `/app/posts/${'b'.repeat(24)}`,
        metadata: {},
        collectionIds: []
      }
    ],
    hasMore: false,
    nextCursor: null
  });
  vi.mocked(bookmarkApi.collections).mockResolvedValue({ items: [], hasMore: false, nextCursor: null });
  vi.mocked(bookmarkApi.activity).mockResolvedValue({
    items: [
      {
        id: 'post:one',
        type: 'post',
        action: 'published',
        createdAt: '2025-01-01T00:00:00.000Z',
        href: '/app/posts/one',
        title: 'You published a post.'
      }
    ],
    hasMore: false,
    nextCursor: null
  });
});
afterEach(cleanup);
it('filters a private saved list and links to available content', async () => {
  renderPage(<SavedItemsPage />);
  expect(await screen.findByText('Useful article')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Open item' }).getAttribute('href')).toBe(
    `/app/posts/${'b'.repeat(24)}`
  );
  fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'post' } });
  await waitFor(() =>
    expect(vi.mocked(bookmarkApi.saved)).toHaveBeenCalledWith(expect.objectContaining({ type: 'post' }))
  );
});
it('renders activity without exposing raw source content', async () => {
  renderPage(<ActivityPage />);
  expect(await screen.findByText('You published a post.')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Show activity'), { target: { value: 'post' } });
  await waitFor(() =>
    expect(vi.mocked(bookmarkApi.activity)).toHaveBeenCalledWith(expect.objectContaining({ type: 'post' }))
  );
});
