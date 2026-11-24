import type { ProfileRatingSummary } from '@voklance/shared';
import { useState } from 'react';
import { apiErrorMessage } from '@/lib/apiClient';
import { usePublicRating, useSavePublicRating } from '../hooks/useProfileData';

export function RatingDisplay({ rating }: { rating?: ProfileRatingSummary }) {
  const average = rating?.average ?? null;
  return (
    <div
      className="profile-rating-display"
      role="img"
      aria-label={
        average === null
          ? 'No ratings yet'
          : `${average.toFixed(1)} out of 5 from ${rating?.count ?? 0} ratings`
      }
    >
      <span className="profile-rating-stars" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => {
          const fill = Math.max(0, Math.min(100, ((average ?? 0) - index) * 100));
          return (
            <span key={index} className="profile-rating-star">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m12 2 3.1 6.3 7 .9-5.1 5 .9 7-5.9-3.2-5.9 3.2.9-7-5.1-5 7-.9L12 2Z" />
              </svg>
              {fill > 0 && (
                <svg
                  className="profile-rating-star-fill"
                  viewBox="0 0 24 24"
                  style={{ clipPath: `inset(0 ${100 - fill}% 0 0)` }}
                  aria-hidden="true"
                >
                  <path d="m12 2 3.1 6.3 7 .9-5.1 5 .9 7-5.9-3.2-5.9 3.2.9-7-5.1-5 7-.9L12 2Z" />
                </svg>
              )}
            </span>
          );
        })}
      </span>
      <span className="profile-rating-copy">
        {average === null ? (
          'No ratings yet'
        ) : (
          <>
            <strong>{average.toFixed(1)}</strong> ({rating?.count ?? 0} ratings)
          </>
        )}
      </span>
    </div>
  );
}

export function ProfileRatingForm({ username }: { username: string }) {
  const rating = usePublicRating(username);
  const save = useSavePublicRating(username);
  const [draft, setDraft] = useState<number | null>(null);
  const selected = draft ?? rating.data?.myRating ?? 0;
  return (
    <section className="profile-rating-form" aria-label="Rate this professional">
      <h2>Rate this professional</h2>
      <p>
        {rating.data?.myRating
          ? `Your rating: ${rating.data.myRating} of 5 stars`
          : 'Choose one to five stars.'}
      </p>
      <div className="profile-rating-controls">
        {[1, 2, 3, 4, 5].map((stars) => (
          <button
            key={stars}
            type="button"
            disabled={save.isPending || rating.isPending || rating.isError}
            aria-label={`Rate ${stars} ${stars === 1 ? 'star' : 'stars'}`}
            aria-pressed={selected === stars}
            className={stars <= selected ? 'selected' : ''}
            onClick={() => {
              setDraft(stars);
              save.mutate(stars, { onError: () => setDraft(null) });
            }}
          >
            {stars <= selected ? '★' : '☆'}
          </button>
        ))}
      </div>
      {save.isPending && <p role="status">Saving rating…</p>}
      {save.isSuccess && <p role="status">Rating saved.</p>}
      {rating.isError && (
        <p role="alert">
          Could not load your rating.{' '}
          <button type="button" className="profile-rating-retry" onClick={() => void rating.refetch()}>
            Try again
          </button>
        </p>
      )}
      {save.isError && <p role="alert">{apiErrorMessage(save.error)}</p>}
    </section>
  );
}
