import type { FeedPost } from '@voklance/shared';
import { useFeed } from '../hooks/useFeed';
import PostCard from './PostCard';

export default function FeedList({ saved = false }: { saved?: boolean }) {
  const query = useFeed(saved);
  if (query.isPending)
    return (
      <p className="feed-state" role="status">
        Loading {saved ? 'saved posts' : 'feed'}…
      </p>
    );
  if (query.isError)
    return (
      <div className="feed-state" role="alert">
        <p>Could not load {saved ? 'saved posts' : 'the feed'}.</p>
        <button type="button" className="feed-text-button" onClick={() => void query.refetch()}>
          Try again
        </button>
      </div>
    );
  const seen = new Set<string>();
  const posts: FeedPost[] = query.data.pages
    .flatMap((page) => page.items)
    .filter((post) => {
      if (seen.has(post.id)) return false;
      seen.add(post.id);
      return true;
    });
  if (!posts.length)
    return (
      <div className="feed-state">
        <p>{saved ? 'You have no saved posts yet.' : 'No posts yet. Start the professional conversation.'}</p>
      </div>
    );
  return (
    <div className="feed-list">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
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
