import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { onboardingKeys } from '@/features/onboarding/hooks/useOnboarding';
import { apiErrorMessage } from '@/lib/apiClient';
import { profileApi } from '../api/profileApi';

export default function ProfileCoverEditor({ hasCover }: { hasCover: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const client = useQueryClient();
  const [error, setError] = useState('');
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: onboardingKeys.profile }),
      client.invalidateQueries({ queryKey: ['profiles', 'public'] })
    ]);
  };
  const upload = useMutation({ mutationFn: profileApi.uploadCover, onSuccess: refresh });
  const remove = useMutation({ mutationFn: profileApi.removeCover, onSuccess: refresh });
  async function choose(file: File | null) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
      setError('Choose a JPEG, PNG, or WebP image up to 8 MB.');
      return;
    }
    setError('');
    try {
      await upload.mutateAsync(file);
    } catch (failure) {
      setError(apiErrorMessage(failure));
    }
  }
  async function clear() {
    setError('');
    try {
      await remove.mutateAsync();
    } catch (failure) {
      setError(apiErrorMessage(failure));
    }
  }
  return (
    <div className="profile-cover-controls">
      <input
        ref={input}
        type="file"
        className="sr-only"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Choose cover image"
        onChange={(event) => {
          void choose(event.target.files?.[0] ?? null);
          event.target.value = '';
        }}
      />
      <button
        type="button"
        disabled={upload.isPending || remove.isPending}
        onClick={() => input.current?.click()}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="6" width="18" height="14" rx="2" />
          <circle cx="12" cy="13" r="3" />
          <path d="M8 6 9 4h6l1 2" />
        </svg>
        {upload.isPending ? 'Uploading…' : 'Edit cover'}
      </button>
      {hasCover && (
        <button type="button" disabled={upload.isPending || remove.isPending} onClick={() => void clear()}>
          Remove cover
        </button>
      )}
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
