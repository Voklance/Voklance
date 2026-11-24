import type { FeedMode, RecommendedPost } from '@voklance/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import PostCard from '@/features/feed/components/PostCard';
import { apiErrorMessage } from '@/lib/apiClient';
import { useRecommendationActions, useRecommendedFeed } from '../hooks/useRecommendations';

function RecommendedCard({ post }: { post: RecommendedPost }) {
  const actions = useRecommendationActions();
  const [feedbackId, setFeedbackId] = useState('');
  const [error, setError] = useState('');
  async function hide(action: 'hidden' | 'not_interested') {
    setError('');
    try {
      const result = await actions.feedback.mutateAsync(['post', post.id, action]);
      setFeedbackId(result.id);
    } catch (failure) {
      setError(apiErrorMessage(failure));
    }
  }
  if (feedbackId)
    return (
      <div className="feed-feedback-state" role="status">
        Post hidden.{' '}
        <button
          type="button"
          onClick={() => void actions.undoFeedback.mutateAsync(feedbackId).then(() => setFeedbackId(''))}
        >
          Undo
        </button>
      </div>
    );
  return (
    <div className="recommended-post">
      <PostCard
        post={post}
        headerAction={
          <details className="feed-post-menu">
            <summary aria-label="Post options">···</summary>
            <div>
              <small>{post.reason}</small>
              <button
                type="button"
                disabled={actions.feedback.isPending}
                onClick={() => void hide('not_interested')}
              >
                Not interested
              </button>
              <button type="button" disabled={actions.feedback.isPending} onClick={() => void hide('hidden')}>
                Hide post
              </button>
            </div>
          </details>
        }
      />
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
export default function RecommendedFeed({ mode }: { mode: FeedMode }) {
  const query = useRecommendedFeed(mode);
  if (query.isPending)
    return (
      <p className="feed-state" role="status">
        Loading feed…
      </p>
    );
  if (query.isError)
    return (
      <div className="feed-state" role="alert">
        <p>The feed could not be loaded.</p>
        <button type="button" onClick={() => void query.refetch()}>
          Try again
        </button>
      </div>
    );
  const posts = [
    ...new Map(query.data.pages.flatMap((page) => page.items).map((post) => [post.id, post])).values()
  ];
  if (!posts.length)
    return (
      <div className="feed-state">
        <p>
          {mode === 'following'
            ? 'Connect with professionals to see their posts here.'
            : 'No available posts yet. Explore communities or update your feed interests.'}
        </p>
        <Link to="/app/network/discover">Discover people</Link> ·{' '}
        <Link to="/app/settings/feed">Feed interests</Link>
      </div>
    );
  return (
    <div className="feed-list">
      {posts.map((post) => (
        <RecommendedCard key={post.id} post={post} />
      ))}
      {query.hasNextPage && (
        <button
          type="button"
          className="feed-load-more"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? 'Loading…' : 'Load more posts'}
        </button>
      )}
    </div>
  );
}
