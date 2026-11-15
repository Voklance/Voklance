import { POST_CONTENT_LIMIT, type FeedPost } from '@voklance/shared';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { apiErrorMessage } from '@/lib/apiClient';
import { useFeedActions } from '../hooks/useFeed';
import PostComments from './PostComments';

function relativeDate(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  return new Date(iso).toLocaleDateString();
}

export default function PostCard({ post }: { post: FeedPost }) {
  const actions = useFeedActions();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.content);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  const busy =
    actions.like.isPending ||
    actions.bookmark.isPending ||
    actions.remove.isPending ||
    actions.edit.isPending;
  async function run(task: () => Promise<unknown>) {
    setError('');
    try {
      await task();
    } catch (failure) {
      setError(apiErrorMessage(failure));
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || actions.edit.isPending) return;
    await run(async () => {
      await actions.edit.mutateAsync({ id: post.id, content: draft.trim() });
      setEditing(false);
    });
  }
  const long = post.content.length > 550;
  return (
    <article className="feed-post" aria-label={`Post by ${post.author.name}`}>
      <header className="feed-post-header">
        <span className="feed-avatar" aria-hidden="true">
          {post.author.name.charAt(0).toUpperCase()}
        </span>
        <div className="feed-author">
          <div>
            {post.author.username ? (
              <Link to={`/app/professionals/${post.author.username}`}>{post.author.name}</Link>
            ) : (
              <strong>{post.author.name}</strong>
            )}
          </div>
          {post.author.headline && <p>{post.author.headline}</p>}
          <time dateTime={post.createdAt}>{relativeDate(post.createdAt)}</time>
        </div>
        {post.ownedByMe && (
          <div className="feed-owner-actions">
            <button
              type="button"
              onClick={() => {
                setDraft(post.content);
                setEditing(true);
              }}
            >
              Edit
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Delete this post?')) void run(() => actions.remove.mutateAsync(post.id));
              }}
            >
              Delete
            </button>
          </div>
        )}
      </header>
      {editing ? (
        <form onSubmit={(event) => void save(event)} className="feed-edit-form">
          <label htmlFor={`edit-post-${post.id}`}>Edit post</label>
          <textarea
            id={`edit-post-${post.id}`}
            rows={5}
            value={draft}
            maxLength={POST_CONTENT_LIMIT}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="feed-inline-actions">
            <button type="button" className="feed-text-button" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button
              type="submit"
              className="feed-primary-button"
              disabled={!draft.trim() || actions.edit.isPending}
            >
              Save changes
            </button>
          </div>
        </form>
      ) : (
        <div className="feed-post-content">
          <p className={long && !expanded ? 'feed-content feed-content-collapsed' : 'feed-content'}>
            {post.content}
          </p>
          {long && (
            <button type="button" className="feed-text-button" onClick={() => setExpanded((value) => !value)}>
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>
      )}
      <div className="feed-engagement">
        <span>
          {post.likeCount} {post.likeCount === 1 ? 'like' : 'likes'}
        </span>
        <span>
          {post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}
        </span>
      </div>
      <div className="feed-post-actions">
        <button
          type="button"
          disabled={busy}
          aria-pressed={post.likedByMe}
          onClick={() => void run(() => actions.like.mutateAsync({ id: post.id, desired: !post.likedByMe }))}
        >
          {post.likedByMe ? 'Unlike' : 'Like'}
        </button>
        <button type="button" aria-expanded={commentsOpen} onClick={() => setCommentsOpen((value) => !value)}>
          Comment
        </button>
        <button
          type="button"
          disabled={busy}
          aria-pressed={post.bookmarkedByMe}
          onClick={() =>
            void run(() => actions.bookmark.mutateAsync({ id: post.id, desired: !post.bookmarkedByMe }))
          }
        >
          {post.bookmarkedByMe ? 'Remove saved' : 'Save'}
        </button>
      </div>
      {error && (
        <p className="feed-error" role="alert">
          {error}
        </p>
      )}
      {commentsOpen && <PostComments postId={post.id} />}
    </article>
  );
}
