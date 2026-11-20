import { useState } from 'react';
import { onboardingIdentitySchema, type IdentityDraft } from '../validation/onboardingSchemas';

type Props = {
  value: IdentityDraft;
  onChange: (value: IdentityDraft, field: keyof IdentityDraft) => void;
  errors: Record<string, string>;
};

export default function ProfileStep({ value, onChange, errors }: Props) {
  const [touched, setTouched] = useState<Partial<Record<keyof IdentityDraft, boolean>>>({});
  const fields: {
    key: keyof IdentityDraft;
    label: string;
    placeholder: string;
    required: boolean;
    max: number;
  }[] = [
    { key: 'firstName', label: 'First name', placeholder: 'Enter your first name', required: true, max: 80 },
    { key: 'lastName', label: 'Last name', placeholder: 'Enter your last name', required: true, max: 80 },
    {
      key: 'headline',
      label: 'Professional headline',
      placeholder: 'What do you do?',
      required: false,
      max: 120
    }
  ];

  return (
    <div className="onboarding-form-grid">
      {fields.map(({ key, label, placeholder, required, max }) => {
        const parsed = onboardingIdentitySchema.safeParse(value);
        const fieldIssue = parsed.success
          ? undefined
          : parsed.error.issues.find((issue) => issue.path[0] === key);
        const error = errors[key] || (touched[key] ? fieldIssue?.message : '') || '';
        const complete = !!value[key].trim() && !fieldIssue && !error;
        return (
          <div className="onboarding-field" key={key}>
            <div className="onboarding-label-row">
              <label htmlFor={`profile-${key}`}>{label}</label>
              {!required && <span className="onboarding-optional">Optional</span>}
            </div>
            <div className="onboarding-input-wrap">
              <input
                id={`profile-${key}`}
                value={value[key]}
                placeholder={placeholder}
                maxLength={max}
                required={required}
                aria-invalid={!!error}
                aria-describedby={`profile-${key}-help`}
                onBlur={() => setTouched((current) => ({ ...current, [key]: true }))}
                onChange={(event) => onChange({ ...value, [key]: event.target.value }, key)}
              />
              {complete && (
                <span className="onboarding-field-check" role="img" aria-label={`${label} complete`}>
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path
                      d="m4.5 10 3.5 3.5 7.5-7.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              )}
            </div>
            <p id={`profile-${key}-help`} className={error ? 'onboarding-error' : 'onboarding-hint'}>
              {error}
            </p>
          </div>
        );
      })}
    </div>
  );
}
