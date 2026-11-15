// @vitest-environment jsdom
import type { FeedComment, FeedPost } from '@voklance/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { feedApi } from '../api/feedApi';
import HomePage from './HomePage';
import SavedPostsPage from './SavedPostsPage';

vi.mock('../api/feedApi', () => ({
  feedApi: {
    feed: vi.fn(),
    saved: vi.fn(),
    create: vi.fn(),
    edit: vi.fn(),
    remove: vi.fn(),
    like: vi.fn(),
    bookmark: vi.fn(),
    comments: vi.fn(),
    addComment: vi.fn(),
    editComment: vi.fn(),
    removeComment: vi.fn()
  }
}));

const post: FeedPost = {
  id: 'a'.repeat(24),
  content: 'A useful professional insight',
  author: { name: 'Ada Engineer', username: 'ada-engineer', headline: 'Software Engineer' },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  likeCount: 0,
  commentCount: 0,
  likedByMe: false,
  bookmarkedByMe: false,
  ownedByMe: true
};
let current: FeedPost[] = [];
let saved: FeedPost[] = [];
let currentComments: FeedComment[] = [];
function renderPage(path = '/app') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } }
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/app" element={<HomePage />} />
          <Route path="/app/saved" element={<SavedPostsPage />} />
          <Route path="/app/professionals/:username" element={<h1>Author profile</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return client;
}
beforeEach(() => {
  vi.clearAllMocks();
  current = [];
  saved = [];
  currentComments = [];
  vi.mocked(feedApi.feed).mockImplementation(async () => ({
    items: [...current],
    nextCursor: null,
    hasMore: false
  }));
  vi.mocked(feedApi.saved).mockImplementation(async () => ({
    items: [...saved],
    nextCursor: null,
    hasMore: false
  }));
  vi.mocked(feedApi.create).mockImplementation(async (content) => {
    current = [{ ...post, content }, ...current];
    return { post: current[0] };
  });
  vi.mocked(feedApi.edit).mockImplementation(async (_id, content) => {
    current = current.map((item) => ({ ...item, content }));
    return { post: current[0] };
  });
  vi.mocked(feedApi.remove).mockImplementation(async () => {
    current = [];
    return {};
  });
  vi.mocked(feedApi.like).mockImplementation(async (_id, desired) => {
    current = current.map((item) => ({ ...item, likedByMe: desired, likeCount: desired ? 1 : 0 }));
    return { likedByMe: desired, likeCount: desired ? 1 : 0 };
  });
  vi.mocked(feedApi.bookmark).mockImplementation(async (_id, desired) => {
    current = current.map((item) => ({ ...item, bookmarkedByMe: desired }));
    saved = desired ? [...current] : [];
    return { bookmarkedByMe: desired };
  });
  vi.mocked(feedApi.comments).mockImplementation(async () => ({
    items: [...currentComments],
    nextCursor: null,
    hasMore: false
  }));
  vi.mocked(feedApi.addComment).mockImplementation(async (_id, content) => {
    const comment: FeedComment = {
      id: 'b'.repeat(24),
      postId: post.id,
      content,
      author: post.author,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      ownedByMe: true
    };
    currentComments = [comment];
    return { comment };
  });
  vi.mocked(feedApi.editComment).mockImplementation(async (_postId, _commentId, content) => {
    currentComments = currentComments.map((item) => ({ ...item, content }));
    return { comment: currentComments[0] };
  });
  vi.mocked(feedApi.removeComment).mockImplementation(async () => {
    currentComments = [];
    return {};
  });
});
afterEach(cleanup);

describe('home feed', () => {
  it('shows loading and then an empty state', async () => {
    let resolve: (value: { items: FeedPost[]; nextCursor: null; hasMore: false }) => void = () => {};
    vi.mocked(feedApi.feed).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    renderPage();
    expect(screen.getByText('Loading feed…')).toBeTruthy();
    resolve({ items: [], nextCursor: null, hasMore: false });
    expect(await screen.findByText('No posts yet. Start the professional conversation.')).toBeTruthy();
  });

  it('shows a retry state for feed errors', async () => {
    vi.mocked(feedApi.feed).mockRejectedValueOnce(new Error('offline'));
    renderPage();
    expect(await screen.findByText('Could not load the feed.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No posts yet. Start the professional conversation.')).toBeTruthy();
  });

  it('creates a post and rejects an empty draft', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Share something with professionals…' }));
    expect(screen.getByRole('button', { name: 'Publish post' })).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByLabelText('Share with professionals'), {
      target: { value: 'A new lesson' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publish post' }));
    await waitFor(() => expect(feedApi.create).toHaveBeenCalled());
    expect(await screen.findByText('A new lesson')).toBeTruthy();
  });

  it('preserves a failed draft for retry', async () => {
    vi.mocked(feedApi.create).mockRejectedValueOnce(new Error('Delivery failed'));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Share something with professionals…' }));
    fireEvent.change(screen.getByLabelText('Share with professionals'), {
      target: { value: 'Keep this draft' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publish post' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByDisplayValue('Keep this draft')).toBeTruthy();
  });

  it('renders author navigation, likes, bookmarks, and owner actions', async () => {
    current = [post];
    renderPage();
    const card = await screen.findByRole('article', { name: 'Post by Ada Engineer' });
    expect(within(card).getByRole('link', { name: 'Ada Engineer' }).getAttribute('href')).toBe(
      '/app/professionals/ada-engineer'
    );
    fireEvent.click(within(card).getByRole('button', { name: 'Like' }));
    expect(await within(card).findByRole('button', { name: 'Unlike' })).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    expect(await within(card).findByRole('button', { name: 'Remove saved' })).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: 'Unlike' }));
    expect(await within(card).findByRole('button', { name: 'Like' })).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: 'Remove saved' }));
    expect(await within(card).findByRole('button', { name: 'Save' })).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Edit' })).toBeTruthy();
  });

  it('keeps like state consistent on failure', async () => {
    current = [post];
    vi.mocked(feedApi.like).mockRejectedValueOnce(new Error('Could not like'));
    renderPage();
    const card = await screen.findByRole('article', { name: 'Post by Ada Engineer' });
    fireEvent.click(within(card).getByRole('button', { name: 'Like' }));
    expect(await within(card).findByText('Could not like')).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Like' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('edits a post and confirms deletion', async () => {
    current = [post];
    renderPage();
    const card = await screen.findByRole('article', { name: 'Post by Ada Engineer' });
    fireEvent.click(within(card).getByRole('button', { name: 'Edit' }));
    fireEvent.change(within(card).getByLabelText('Edit post'), { target: { value: 'Revised thought' } });
    fireEvent.click(within(card).getByRole('button', { name: 'Save changes' }));
    expect(await within(card).findByText('Revised thought')).toBeTruthy();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(within(card).getByRole('button', { name: 'Delete' }));
    expect(feedApi.remove).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(within(card).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(feedApi.remove).toHaveBeenCalled());
    confirm.mockRestore();
  });

  it('loads and submits flat comments', async () => {
    current = [post];
    renderPage();
    const card = await screen.findByRole('article', { name: 'Post by Ada Engineer' });
    fireEvent.click(within(card).getByRole('button', { name: 'Comment' }));
    expect(await within(card).findByText('No comments yet.')).toBeTruthy();
    fireEvent.change(within(card).getByLabelText('Add a comment'), { target: { value: 'Great point' } });
    fireEvent.click(within(card).getByRole('button', { name: 'Post comment' }));
    await waitFor(() => expect(feedApi.addComment).toHaveBeenCalled());
    expect(await within(card).findByText('Great point')).toBeTruthy();
  });

  it('edits and deletes an owned comment after confirmation', async () => {
    current = [post];
    currentComments = [
      {
        id: 'b'.repeat(24),
        postId: post.id,
        content: 'Original comment',
        author: post.author,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        ownedByMe: true
      }
    ];
    renderPage();
    const card = await screen.findByRole('article', { name: 'Post by Ada Engineer' });
    fireEvent.click(within(card).getByRole('button', { name: 'Comment' }));
    expect(await within(card).findByText('Original comment')).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: 'Edit comment' }));
    fireEvent.change(within(card).getByLabelText('Edit comment'), { target: { value: 'Updated comment' } });
    fireEvent.click(within(card).getByRole('button', { name: 'Save comment' }));
    expect(await within(card).findByText('Updated comment')).toBeTruthy();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(within(card).getByRole('button', { name: 'Delete comment' }));
    await waitFor(() => expect(feedApi.removeComment).toHaveBeenCalled());
    confirm.mockRestore();
  });

  it('shows saved posts and loads another page on demand', async () => {
    saved = [post];
    vi.mocked(feedApi.saved).mockResolvedValueOnce({
      items: [post],
      nextCursor: 'cursor-two',
      hasMore: true
    });
    renderPage('/app/saved');
    expect(await screen.findByRole('heading', { name: 'Saved posts' })).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Load more posts' }));
    await waitFor(() => expect(feedApi.saved).toHaveBeenCalledTimes(2));
  });
});
