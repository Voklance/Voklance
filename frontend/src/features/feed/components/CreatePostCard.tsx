import { POST_CONTENT_LIMIT, type AuthUser } from '@voklance/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiErrorMessage } from '@/lib/apiClient';
import { useFlash } from '@/components/shared/FlashMessages';
import { currentUserKey } from '@/features/auth/cache/authCache';
import { useFeedActions } from '../hooks/useFeed';
import { useMyProfile } from '@/features/profiles/hooks/useProfileData';
import { mediaUrl } from '@/lib/mediaUrl';

export default function CreatePostCard() {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const photoInput = useRef<HTMLInputElement>(null);
  const documentInput = useRef<HTMLInputElement>(null);
  const actions = useFeedActions();
  const { showFlash } = useFlash();
  const client = useQueryClient();
  const user = client.getQueryData<AuthUser>(currentUserKey);
  const initial = user?.name.trim().charAt(0).toUpperCase() || 'Y';
  const avatarUrl = useMyProfile().data?.profile?.avatarUrl;
  useEffect(() => {
    if (!file || !file.type.startsWith('image/') || !URL.createObjectURL) {
      setPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function selectFile(selected: File | null) {
    if (!selected) return;
    const supported = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(selected.type);
    const limit = selected.type === 'application/pdf' ? 15 * 1024 * 1024 : 8 * 1024 * 1024;
    if (!supported || selected.size > limit) {
      setFileError(
        supported
          ? 'Images must be 8 MB or smaller; PDFs must be 15 MB or smaller.'
          : 'Choose a JPEG, PNG, WebP, or PDF file.'
      );
      setOpen(true);
      return;
    }
    setFileError('');
    setFile(selected);
    setOpen(true);
  }
  async function publish(event: FormEvent) {
    event.preventDefault();
    if ((!content.trim() && !file) || content.length > POST_CONTENT_LIMIT || actions.create.isPending) return;
    try {
      await actions.create.mutateAsync(file ? { content: content.trim(), file } : content.trim());
      setContent('');
      setFile(null);
      setOpen(false);
      showFlash({ type: 'success', message: 'Your post has been published.' });
    } catch (error) {
      showFlash({ type: 'error', message: apiErrorMessage(error) });
      /* The draft remains so the user can retry. */
    }
  }
  return (
    <section className="feed-composer" aria-label="Create a post">
      <input
        ref={photoInput}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Choose a photo"
        onChange={(event) => {
          selectFile(event.target.files?.[0] ?? null);
          event.target.value = '';
        }}
      />
      <input
        ref={documentInput}
        className="sr-only"
        type="file"
        accept="application/pdf,.pdf"
        aria-label="Choose a PDF"
        onChange={(event) => {
          selectFile(event.target.files?.[0] ?? null);
          event.target.value = '';
        }}
      />
      {!open ? (
        <>
          <div className="feed-composer-entry">
            <span className="feed-avatar" aria-hidden="true">
              {avatarUrl ? <img src={mediaUrl(avatarUrl)} alt="" /> : initial}
            </span>
            <button type="button" className="feed-composer-trigger" onClick={() => setOpen(true)}>
              Start a post…
            </button>
          </div>
          <div className="feed-composer-shortcuts">
            <button type="button" disabled title="Video posts are unavailable">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="5" width="14" height="14" rx="2" />
                <path d="m17 10 4-3v10l-4-3M7 9h6M7 13h4" />
              </svg>
              Video
            </button>
            <button type="button" onClick={() => photoInput.current?.click()}>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <circle cx="8" cy="9" r="1.5" />
                <path d="m4 17 5-5 3 3 3-4 5 6" />
              </svg>
              Photo
            </button>
            <button type="button" onClick={() => documentInput.current?.click()}>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 2h8l5 5v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm8 0v5h5M8 12h8M8 16h8" />
              </svg>
              Document
            </button>
            <button type="button" onClick={() => setOpen(true)}>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 3h9l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm9 0v5h4M8 12h8M8 16h8" />
              </svg>
              Write an article
            </button>
          </div>
        </>
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
          {file && (
            <div className="feed-selected-file">
              {previewUrl && <img src={previewUrl} alt="Selected post photo preview" />}
              <span>
                {file.type === 'application/pdf' ? 'PDF · ' : 'Photo · '}
                {file.name}
              </span>
              <button type="button" onClick={() => setFile(null)} aria-label="Remove attachment">
                Remove
              </button>
            </div>
          )}
          <div className="feed-composer-attach">
            <button type="button" onClick={() => photoInput.current?.click()}>
              Add photo
            </button>
            <button type="button" onClick={() => documentInput.current?.click()}>
              Add PDF
            </button>
          </div>
          <div className="feed-composer-footer">
            <span>
              {content.length}/{POST_CONTENT_LIMIT}
            </span>
            <span>Professionals on Voklance</span>
          </div>
          {actions.create.isError && (
            <p role="alert" className="form-alert">
              {apiErrorMessage(actions.create.error)}
            </p>
          )}
          {fileError && (
            <p role="alert" className="form-alert">
              {fileError}
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
              disabled={(!content.trim() && !file) || actions.create.isPending}
            >
              {actions.create.isPending ? 'Publishing…' : 'Publish post'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
