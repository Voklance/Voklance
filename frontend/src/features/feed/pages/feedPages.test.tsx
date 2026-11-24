// @vitest-environment jsdom
import type { FeedComment, FeedPost, RecommendedPost } from '@voklance/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { feedApi } from '../api/feedApi';
import { recommendationApi } from '@/features/recommendations/api/recommendationApi';
import { profileApi } from '@/features/profiles/api/profileApi';
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
    follow: vi.fn(),
    bookmark: vi.fn(),
    comments: vi.fn(),
    addComment: vi.fn(),
    editComment: vi.fn(),
    removeComment: vi.fn()
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
vi.mock('@/features/profiles/api/profileApi', () => ({ profileApi: { own: vi.fn() } }));

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
  vi.mocked(profileApi.own).mockResolvedValue({ profile: null });
  current = [];
  saved = [];
  currentComments = [];
  vi.mocked(feedApi.feed).mockImplementation(async () => ({
    items: [...current],
    nextCursor: null,
    hasMore: false
  }));
  vi.mocked(recommendationApi.feed).mockImplementation(async () => ({
    items: current.map((item) => ({ ...item, reason: 'Recent professional post' })),
    nextCursor: null,
    hasMore: false
  }));
  vi.mocked(recommendationApi.recommendations).mockResolvedValue({
    items: [],
    hasMore: false,
    nextCursor: null
  });
  vi.mocked(feedApi.saved).mockImplementation(async () => ({
    items: [...saved],
    nextCursor: null,
    hasMore: false
  }));
  vi.mocked(feedApi.create).mockImplementation(async (input) => {
    current = [
      {
        ...post,
        content: typeof input === 'string' ? input : input.content,
        ...(typeof input === 'string'
          ? {}
          : {
              attachment: {
                id: 'c'.repeat(24),
                kind: input.file.type === 'application/pdf' ? ('document' as const) : ('image' as const),
                url: `/api/v1/media/${'c'.repeat(24)}`,
                filename: input.file.name,
                mimeType: input.file.type,
                size: input.file.size
              }
            })
      },
      ...current
    ];
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
  vi.mocked(feedApi.like).mockImplementation(async (_id, desired, reaction = 'like') => {
    current = current.map((item) => ({
      ...item,
      likedByMe: desired,
      reactionByMe: desired ? reaction : null,
      reactionCounts: desired ? { [reaction]: 1 } : {},
      likeCount: desired ? 1 : 0
    }));
    return { likedByMe: desired, reactionByMe: desired ? reaction : null, likeCount: desired ? 1 : 0 };
  });
  vi.mocked(feedApi.follow).mockImplementation(async (_id, desired) => {
    current = current.map((item) => ({ ...item, followingAuthor: desired }));
    return { followingAuthor: desired };
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
  it('starts with newest posts, offers sort choices, and shows available composer actions', async () => {
    current = [{ ...post, author: { ...post.author, avatarUrl: 'https://example.test/ada.jpg' } }];
    renderPage();
    const sort = screen.getByRole('combobox', { name: 'Sort by:' });
    expect((sort as HTMLSelectElement).value).toBe('recent');
    expect(screen.queryByText('People you may know')).toBeNull();
    expect(screen.queryByText('Suggested communities')).toBeNull();
    expect(screen.getByRole('button', { name: 'Video' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Photo' })).toHaveProperty('disabled', false);
    expect(screen.getByRole('button', { name: 'Document' })).toHaveProperty('disabled', false);
    const card = await screen.findByRole('article', { name: 'Post by Ada Engineer' });
    expect(card.querySelector('.feed-avatar img')?.getAttribute('src')).toBe('https://example.test/ada.jpg');
    fireEvent.change(sort, { target: { value: 'for-you' } });
    await waitFor(() => expect(recommendationApi.feed).toHaveBeenCalledWith('for-you', undefined));
  });

  it('shows loading and then an empty state', async () => {
    let resolve: (value: { items: RecommendedPost[]; nextCursor: null; hasMore: false }) => void = () => {};
    vi.mocked(recommendationApi.feed).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    renderPage();
    expect(screen.getByText('Loading feed…')).toBeTruthy();
    resolve({ items: [], nextCursor: null, hasMore: false });
    expect(
      await screen.findByText('No available posts yet. Explore communities or update your feed interests.')
    ).toBeTruthy();
  });

  it('shows a retry state for feed errors', async () => {
    vi.mocked(recommendationApi.feed).mockRejectedValueOnce(new Error('offline'));
    renderPage();
    expect(await screen.findByText('The feed could not be loaded.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByText('No available posts yet. Explore communities or update your feed interests.')
    ).toBeTruthy();
  });

  it('creates a post and rejects an empty draft', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Start a post…' }));
    expect(screen.getByRole('button', { name: 'Publish post' })).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByLabelText('Share with professionals'), {
      target: { value: 'A new lesson' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publish post' }));
    await waitFor(() => expect(feedApi.create).toHaveBeenCalled());
    expect(await screen.findByText('A new lesson')).toBeTruthy();
  });

  it('publishes a photo without text and displays it in the feed', async () => {
    renderPage();
    const file = new File(['png'], 'work.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Choose a photo'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Publish post' }));
    await waitFor(() =>
      expect(feedApi.create).toHaveBeenCalledWith({ content: '', file }, expect.anything())
    );
    expect(await screen.findByRole('img', { name: 'work.png' })).toBeTruthy();
  });

  it('shows a PDF download card', async () => {
    current = [
      {
        ...post,
        content: '',
        attachment: {
          id: 'c'.repeat(24),
          kind: 'document',
          url: `/api/v1/media/${'c'.repeat(24)}`,
          filename: 'resume.pdf',
          mimeType: 'application/pdf',
          size: 1024
        }
      }
    ];
    renderPage();
    const link = await screen.findByRole('link', { name: /resume.pdf/i });
    expect(link.getAttribute('href')).toContain('/api/v1/media/');
    expect(link.getAttribute('download')).toBe('resume.pdf');
  });

  it('preserves a failed draft for retry', async () => {
    vi.mocked(feedApi.create).mockRejectedValueOnce(new Error('Delivery failed'));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Start a post…' }));
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
    expect(card.querySelectorAll('.feed-reaction-icon svg')).toHaveLength(1);
    fireEvent.click(within(card).getByRole('button', { name: 'Save' }));
    expect(await within(card).findByRole('button', { name: 'Remove saved' })).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: 'Unlike' }));
    expect(await within(card).findByRole('button', { name: 'Like' })).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: 'Remove saved' }));
    expect(await within(card).findByRole('button', { name: 'Save' })).toBeTruthy();
    fireEvent.click(within(card).getByText('···'));
    expect(within(card).getByRole('button', { name: 'Edit post' })).toBeTruthy();
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

  it('shows the designation, follows authors, and selects a hover reaction', async () => {
    current = [{ ...post, ownedByMe: false }];
    renderPage();
    const card = await screen.findByRole('article', { name: 'Post by Ada Engineer' });
    expect(within(card).getByText('Software Engineer')).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: '+ Follow' }));
    expect(await within(card).findByRole('button', { name: 'Following' })).toBeTruthy();
    fireEvent.mouseEnter(within(card).getByRole('button', { name: 'Like' }));
    fireEvent.click(within(card).getByRole('button', { name: 'Love' }));
    await waitFor(() => expect(feedApi.like).toHaveBeenCalledWith(post.id, true, 'love'));
    expect(await within(card).findByRole('button', { name: 'Unlike' })).toBeTruthy();
  });

  it('edits a post and confirms deletion', async () => {
    current = [post];
    renderPage();
    const card = await screen.findByRole('article', { name: 'Post by Ada Engineer' });
    fireEvent.click(within(card).getByText('···'));
    fireEvent.click(within(card).getByRole('button', { name: 'Edit post' }));
    fireEvent.change(within(card).getByLabelText('Edit post'), { target: { value: 'Revised thought' } });
    fireEvent.click(within(card).getByRole('button', { name: 'Save changes' }));
    expect(await within(card).findByText('Revised thought')).toBeTruthy();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(within(card).getByRole('button', { name: 'Delete post' }));
    expect(feedApi.remove).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(within(card).getByRole('button', { name: 'Delete post' }));
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
