import { useEffect, useState } from 'react';
import { USERNAME_PATTERN } from '@voklance/shared';
import { onboardingApi } from '../api/onboardingApi';
import type { ProfileDraft } from '../validation/onboardingSchemas';

type Props = {
  value: ProfileDraft;
  onChange: (value: ProfileDraft) => void;
  errors: Record<string, string>;
  onAvailability: (available: boolean | null) => void;
};

export default function ProfileStep({ value, onChange, errors, onAvailability }: Props) {
  const [availability, setAvailability] = useState<'idle' | 'checking' | 'available' | 'taken' | 'error'>(
    'idle'
  );
  useEffect(() => {
    const username = value.username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(username)) {
      onAvailability(null);
      return;
    }
    const controller = new AbortController();
    setAvailability('checking');
    onAvailability(null);
    const timer = window.setTimeout(() => {
      onboardingApi
        .username(username, controller.signal)
        .then((result) => {
          setAvailability(result.available ? 'available' : 'taken');
          onAvailability(result.available);
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setAvailability('error');
            onAvailability(null);
          }
        });
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [value.username, onAvailability]);

  function update(field: keyof ProfileDraft, next: string) {
    onChange({ ...value, [field]: next });
  }
  const fields: { key: keyof ProfileDraft; label: string; required?: boolean; max: number }[] = [
    { key: 'fullName', label: 'Full name', required: true, max: 80 },
    { key: 'username', label: 'Username', required: true, max: 30 },
    { key: 'headline', label: 'Professional headline', required: true, max: 120 },
    { key: 'country', label: 'Country', required: true, max: 100 },
    { key: 'city', label: 'City', max: 100 }
  ];
  return (
    <div className="onboarding-form-grid">
      {fields.map(({ key, label, required, max }) => (
        <div className="onboarding-field" key={key}>
          <label htmlFor={`profile-${key}`}>
            {label}
            {!required && <span>Optional</span>}
          </label>
          <input
            id={`profile-${key}`}
            value={value[key]}
            maxLength={max}
            required={required}
            aria-invalid={!!errors[key] || (key === 'username' && availability === 'taken')}
            aria-describedby={`profile-${key}-help`}
            onChange={(event) => update(key, event.target.value)}
          />
          <p
            id={`profile-${key}-help`}
            className={
              errors[key] || (key === 'username' && availability === 'taken')
                ? 'onboarding-error'
                : 'onboarding-hint'
            }
            aria-live={key === 'username' ? 'polite' : undefined}
          >
            {errors[key] ||
              (key === 'username'
                ? {
                    idle: '3–30 characters; start with a letter.',
                    checking: 'Checking availability…',
                    available: 'Username is available.',
                    taken: 'Username is already in use.',
                    error: 'Could not check username. Try again.'
                  }[availability]
                : '')}
          </p>
        </div>
      ))}
      <div className="onboarding-field onboarding-wide">
        <label htmlFor="profile-bio">
          Short bio <span>Optional</span>
        </label>
        <textarea
          id="profile-bio"
          value={value.bio}
          maxLength={500}
          rows={4}
          aria-invalid={!!errors.bio}
          aria-describedby="profile-bio-help"
          onChange={(event) => update('bio', event.target.value)}
        />
        <p id="profile-bio-help" className="onboarding-error">
          {errors.bio}
        </p>
      </div>
      <div className="onboarding-avatar onboarding-wide" aria-label="Profile picture">
        <div className="onboarding-avatar-placeholder" aria-hidden="true">
          {value.fullName.trim().slice(0, 1).toUpperCase() || 'V'}
        </div>
        <div>
          <strong>Profile picture</strong>
          <p>Optional. Photo upload is not available yet; you can add one when uploads are supported.</p>
        </div>
      </div>
    </div>
  );
}
