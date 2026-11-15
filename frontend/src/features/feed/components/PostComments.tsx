import { COMMENT_CONTENT_LIMIT, type FeedComment } from '@voklance/shared';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { apiErrorMessage } from '@/lib/apiClient';
import { useCommentActions, useComments } from '../hooks/useFeed';

function CommentItem({ comment, postId }: { comment: FeedComment; postId: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);
  const actions = useCommentActions(postId);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || actions.edit.isPending) return;
    try {
      await actions.edit.mutateAsync({ id: comment.id, content: draft.trim() });
      setEditing(false);
    } catch {
      /* Keep the draft. */
    }
  }
  async function remove() {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await actions.remove.mutateAsync(comment.id);
    } catch {
      /* Error is displayed below. */
    }
  }
  return (
    <li className="feed-comment">
      <span className="feed-avatar" aria-hidden="true">
        {comment.author.name.charAt(0).toUpperCase()}
      </span>
      <div className="feed-comment-body">
        <div className="feed-comment-heading">
          {comment.author.username ? (
            <Link to={`/app/professionals/${comment.author.username}`}>{comment.author.name}</Link>
          ) : (
            <strong>{comment.author.name}</strong>
          )}
          <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleDateString()}</time>
        </div>
        {editing ? (
          <form onSubmit={(event) => void save(event)}>
            <label className="feed-visually-hidden" htmlFor={`comment-edit-${comment.id}`}>
              Edit comment
            </label>
            <textarea
              id={`comment-edit-${comment.id}`}
              value={draft}
              maxLength={COMMENT_CONTENT_LIMIT}
              onChange={(event) => setDraft(event.target.value)}
            />
            <div className="feed-inline-actions">
              <button className="feed-text-button" type="button" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button
                className="feed-primary-button"
                type="submit"
                disabled={!draft.trim() || actions.edit.isPending}
              >
                Save comment
              </button>
            </div>
          </form>
        ) : (
          <p className="feed-content">{comment.content}</p>
        )}
        {comment.ownedByMe && !editing && (
          <div className="feed-inline-actions">
            <button type="button" className="feed-text-button" onClick={() => setEditing(true)}>
              Edit comment
            </button>
            <button
              type="button"
              className="feed-text-button"
              disabled={actions.remove.isPending}
              onClick={() => void remove()}
            >
              Delete comment
            </button>
          </div>
        )}
        {(actions.edit.isError || actions.remove.isError) && (
          <p role="alert">{apiErrorMessage(actions.edit.error ?? actions.remove.error)}</p>
        )}
      </div>
    </li>
  );
}

export default function PostComments({ postId }: { postId: string }) {
  const query = useComments(postId, true);
  const actions = useCommentActions(postId);
  const [content, setContent] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!content.trim() || actions.add.isPending) return;
    try {
      await actions.add.mutateAsync(content.trim());
      setContent('');
    } catch {
      /* Keep the draft. */
    }
  }
  const comments = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <section className="feed-comments" aria-label="Post comments">
      <form onSubmit={(event) => void submit(event)}>
        <label htmlFor={`new-comment-${postId}`}>Add a comment</label>
        <textarea
          id={`new-comment-${postId}`}
          rows={2}
          maxLength={COMMENT_CONTENT_LIMIT}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Add to the conversation"
        />
        <div className="feed-inline-actions">
          <span>
            {content.length}/{COMMENT_CONTENT_LIMIT}
          </span>
          <button
            type="submit"
            className="feed-primary-button"
            disabled={!content.trim() || actions.add.isPending}
          >
            {actions.add.isPending ? 'Posting…' : 'Post comment'}
          </button>
        </div>
      </form>
      {actions.add.isError && <p role="alert">{apiErrorMessage(actions.add.error)}</p>}
      {query.isPending && <p role="status">Loading comments…</p>}
      {query.isError && (
        <p role="alert">
          Could not load comments.{' '}
          <button type="button" className="feed-text-button" onClick={() => void query.refetch()}>
            Try again
          </button>
        </p>
      )}
      {!query.isPending && !query.isError && !comments.length && (
        <p className="feed-hint">No comments yet.</p>
      )}
      <ul className="feed-comment-list">
        {comments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} postId={postId} />
        ))}
      </ul>
      {query.hasNextPage && (
        <button
          type="button"
          className="feed-text-button"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? 'Loading…' : 'Load more comments'}
        </button>
      )}
    </section>
  );
}
