import { POST_CONTENT_LIMIT } from '@voklance/shared';
import { useState, type FormEvent } from 'react';
import { apiErrorMessage } from '@/lib/apiClient';
import { useFeedActions } from '../hooks/useFeed';

export default function CreatePostCard() {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const actions = useFeedActions();
  async function publish(event: FormEvent) {
    event.preventDefault();
    if (!content.trim() || content.length > POST_CONTENT_LIMIT || actions.create.isPending) return;
    try {
      await actions.create.mutateAsync(content.trim());
      setContent('');
      setOpen(false);
    } catch {
      /* The draft remains so the user can retry. */
    }
  }
  return (
    <section className="feed-composer" aria-label="Create a post">
      {!open ? (
        <button type="button" className="feed-composer-trigger" onClick={() => setOpen(true)}>
          Share something with professionals…
        </button>
      ) : (
        <form onSubmit={(event) => void publish(event)}>
          <label htmlFor="new-post">Share with professionals</label>
          <textarea
            id="new-post"
            autoFocus
            rows={5}
            maxLength={POST_CONTENT_LIMIT}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="What have you learned or worked on?"
          />
          <div className="feed-composer-footer">
            <span>
              {content.length}/{POST_CONTENT_LIMIT}
            </span>
            <span>Professionals on Voklance</span>
          </div>
          <p className="feed-hint">
            Image and document attachments will be available after storage is configured.
          </p>
          {actions.create.isError && (
            <p role="alert" className="form-alert">
              {apiErrorMessage(actions.create.error)}
            </p>
          )}
          <div className="feed-inline-actions">
            <button
              type="button"
              className="feed-text-button"
              onClick={() => setOpen(false)}
              disabled={actions.create.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="feed-primary-button"
              disabled={!content.trim() || actions.create.isPending}
            >
              {actions.create.isPending ? 'Publishing…' : 'Publish post'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
