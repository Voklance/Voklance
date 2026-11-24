import { POST_CONTENT_LIMIT, POST_REACTIONS, type FeedPost, type PostReaction } from '@voklance/shared';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { apiErrorMessage } from '@/lib/apiClient';
import { mediaUrl } from '@/lib/mediaUrl';
import { useFeedActions } from '../hooks/useFeed';
import PostComments from './PostComments';

function relativeDate(iso: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  const days = Math.floor(minutes / 1440);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function ActionIcon({ name }: { name: 'like' | 'comment' | 'save' | 'send' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {name === 'like' && (
        <path d="M7 10v11H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3Zm0 0 4.6-7.1a2 2 0 0 1 3.6 1.6L14 9h5a3 3 0 0 1 2.9 3.7l-1.6 6A3 3 0 0 1 17.4 21H7" />
      )}
      {name === 'comment' && (
        <path d="M20.5 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-3.8-.8L3 21l1.7-5.1A8.5 8.5 0 1 1 20.5 11.5Z" />
      )}
      {name === 'save' && <path d="M5 3h14v18l-7-4-7 4V3Z" />}
      {name === 'send' && <path d="m21 3-8.8 18-3.1-7.1L2 10.8 21 3ZM9.1 13.9 21 3" />}
    </svg>
  );
}

const reactionLabels: Record<PostReaction, string> = {
  like: 'Like',
  love: 'Love',
  celebrate: 'Celebrate',
  insightful: 'Insightful'
};
function ReactionIcon({ reaction }: { reaction: PostReaction }) {
  if (reaction === 'like') return <ActionIcon name="like" />;
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {reaction === 'love' && (
        <path d="M12 20.5 3.6 12.2a5.1 5.1 0 0 1 7.2-7.2L12 6.2 13.2 5a5.1 5.1 0 0 1 7.2 7.2L12 20.5Z" />
      )}
      {reaction === 'celebrate' && (
        <path d="m12 2 2.9 6.2 6.8.9-5 4.8 1.2 6.8-5.9-3.2-5.9 3.2 1.2-6.8-5-4.8 6.8-.9L12 2Z" />
      )}
      {reaction === 'insightful' && (
        <>
          <path d="M9 18h6m-5 3h4M8.5 15a7 7 0 1 1 7 0c-.7.5-1 1.3-1 2h-5c0-.7-.3-1.5-1-2Z" />
        </>
      )}
    </svg>
  );
}

export default function PostCard({ post, headerAction }: { post: FeedPost; headerAction?: ReactNode }) {
  const actions = useFeedActions();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.content);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  const [shareStatus, setShareStatus] = useState('');
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const busy =
    actions.like.isPending ||
    actions.follow.isPending ||
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
  async function share() {
    setShareStatus('');
    const url = `${window.location.origin}/app/posts/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: `Post by ${post.author.name}`, url });
      else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setShareStatus('Post link copied.');
      } else setShareStatus('Sharing is unavailable on this device.');
    } catch (failure) {
      if (failure instanceof DOMException && failure.name === 'AbortError') return;
      setShareStatus('Could not share this post.');
    }
  }
  const long = post.content.length > 550;
  const selectedReaction = post.reactionByMe ?? (post.likedByMe ? 'like' : null);
  const shownReactions = POST_REACTIONS.filter(
    (reaction) =>
      (post.reactionCounts
        ? (post.reactionCounts[reaction] ?? 0)
        : reaction === 'like'
          ? post.likeCount
          : 0) > 0
  );
  return (
    <article className="feed-post" aria-label={`Post by ${post.author.name}`}>
      <header className="feed-post-header">
        <span className="feed-avatar" aria-hidden="true">
          {post.author.avatarUrl ? (
            <img src={mediaUrl(post.author.avatarUrl)} alt="" />
          ) : (
            post.author.name.charAt(0).toUpperCase()
          )}
        </span>
        <div className="feed-author">
          <div className="feed-author-line">
            {post.author.username ? (
              <Link to={`/app/professionals/${post.author.username}`}>{post.author.name}</Link>
            ) : (
              <strong>{post.author.name}</strong>
            )}
            <time dateTime={post.createdAt}>· {relativeDate(post.createdAt)}</time>
          </div>
          {post.author.headline && <p>{post.author.headline}</p>}
        </div>
        {post.ownedByMe && (
          <details className="feed-post-menu">
            <summary aria-label="Post options">···</summary>
            <div>
              <button
                type="button"
                onClick={() => {
                  setDraft(post.content);
                  setEditing(true);
                }}
              >
                Edit post
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm('Delete this post?'))
                    void run(() => actions.remove.mutateAsync(post.id));
                }}
              >
                Delete post
              </button>
            </div>
          </details>
        )}
        {!post.ownedByMe && (
          <div className="feed-header-controls">
            <button
              type="button"
              className="feed-follow-button"
              disabled={actions.follow.isPending}
              aria-pressed={!!post.followingAuthor}
              onClick={() =>
                void run(() => actions.follow.mutateAsync({ id: post.id, desired: !post.followingAuthor }))
              }
            >
              {post.followingAuthor ? 'Following' : '+ Follow'}
            </button>
            {headerAction}
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
          {post.content && (
            <p className={long && !expanded ? 'feed-content feed-content-collapsed' : 'feed-content'}>
              {post.content}
            </p>
          )}
          {long && (
            <button type="button" className="feed-text-button" onClick={() => setExpanded((value) => !value)}>
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
          {post.attachment?.kind === 'image' && (
            <a
              className="feed-post-photo"
              href={mediaUrl(post.attachment.url)}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open photo ${post.attachment.filename}`}
            >
              <img src={mediaUrl(post.attachment.url)} alt={post.attachment.filename} loading="lazy" />
            </a>
          )}
          {post.attachment?.kind === 'document' && (
            <a
              className="feed-post-document"
              href={mediaUrl(post.attachment.url)}
              target="_blank"
              rel="noreferrer"
              download={post.attachment.filename}
            >
              <span className="feed-document-icon" aria-hidden="true">
                PDF
              </span>
              <span>
                <strong>{post.attachment.filename}</strong>
                <small>PDF document · {(post.attachment.size / 1024 / 1024).toFixed(1)} MB</small>
              </span>
              <span aria-hidden="true">↗</span>
            </a>
          )}
        </div>
      )}
      <div className="feed-engagement">
        <span className="feed-reaction-count">
          {shownReactions.length > 0 && (
            <span className="feed-reaction-icons" aria-hidden="true">
              {shownReactions.map((reaction) => (
                <span key={reaction} className={`feed-reaction-icon feed-reaction-${reaction}`}>
                  <ReactionIcon reaction={reaction} />
                </span>
              ))}
            </span>
          )}
          {post.likeCount.toLocaleString()} {post.likeCount === 1 ? 'like' : 'likes'}
        </span>
        <span>
          {post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}
        </span>
      </div>
      <div className="feed-post-actions">
        <div
          className="feed-like-group"
          onMouseEnter={() => setReactionPickerOpen(true)}
          onMouseLeave={() => setReactionPickerOpen(false)}
          onFocus={() => setReactionPickerOpen(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setReactionPickerOpen(false);
          }}
        >
          <button
            type="button"
            disabled={busy}
            aria-pressed={post.likedByMe}
            onClick={() =>
              void run(() =>
                actions.like.mutateAsync({
                  id: post.id,
                  desired: !post.likedByMe,
                  reaction: selectedReaction ?? 'like'
                })
              )
            }
          >
            <ReactionIcon reaction={selectedReaction ?? 'like'} />
            {post.likedByMe ? 'Unlike' : 'Like'}
          </button>
          {reactionPickerOpen && (
            <div className="feed-reaction-picker" role="group" aria-label="Choose a reaction">
              {POST_REACTIONS.map((reaction) => (
                <button
                  key={reaction}
                  type="button"
                  disabled={busy}
                  aria-label={reactionLabels[reaction]}
                  aria-pressed={selectedReaction === reaction}
                  className={`feed-reaction-choice feed-reaction-${reaction}`}
                  onClick={() => {
                    setReactionPickerOpen(false);
                    void run(() => actions.like.mutateAsync({ id: post.id, desired: true, reaction }));
                  }}
                >
                  <ReactionIcon reaction={reaction} />
                  <span>{reactionLabels[reaction]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" aria-expanded={commentsOpen} onClick={() => setCommentsOpen((value) => !value)}>
          <ActionIcon name="comment" />
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
          <ActionIcon name="save" />
          {post.bookmarkedByMe ? 'Remove saved' : 'Save'}
        </button>
        <button type="button" onClick={() => void share()}>
          <ActionIcon name="send" />
          Send
        </button>
      </div>
      {shareStatus && (
        <p className="feed-share-status" role="status">
          {shareStatus}
        </p>
      )}
      {error && (
        <p className="feed-error" role="alert">
          {error}
        </p>
      )}
      {commentsOpen && <PostComments postId={post.id} />}
    </article>
  );
}
