import {
  RESOURCE_CATEGORIES,
  RESOURCE_CATEGORY_LABELS,
  commandPayloadSchemas,
  type CommandId,
  type CommandMetadata,
  type CommandSubmission
} from '@voklance/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiErrorMessage } from '@/lib/apiClient';
import { useCommandActions } from '../hooks/useCommunityCommands';
import { zonedDateTime } from '@/features/events/utils/zonedDateTime';

type Field = {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'url' | 'datetime-local' | 'number' | 'select';
  required?: boolean;
  max?: number;
  options?: { value: string; label: string }[];
};
const workModes = [
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' }
];
const locationTypes = [
  { value: 'online', label: 'Online' },
  { value: 'in_person', label: 'In person' },
  { value: 'hybrid', label: 'Hybrid' }
];
const fields: Record<CommandId, Field[]> = {
  resource: [
    { name: 'title', label: 'Resource title', type: 'text', required: true, max: 160 },
    { name: 'description', label: 'Description', type: 'textarea', required: true, max: 2000 },
    { name: 'url', label: 'Resource link (HTTPS)', type: 'url', required: true, max: 2048 },
    {
      name: 'category',
      label: 'Category',
      type: 'select',
      required: true,
      options: RESOURCE_CATEGORIES.map((category) => ({
        value: category,
        label: RESOURCE_CATEGORY_LABELS[category]
      }))
    },
    { name: 'tags', label: 'Topics (comma separated)', type: 'text', max: 250 }
  ],
  discussion: [
    { name: 'title', label: 'Discussion title', type: 'text', required: true, max: 160 },
    { name: 'body', label: 'Your message', type: 'textarea', required: true, max: 4000 }
  ],
  referral: [
    { name: 'jobTitle', label: 'Job title', type: 'text', required: true, max: 120 },
    { name: 'company', label: 'Company', type: 'text', required: true, max: 120 },
    { name: 'location', label: 'Location', type: 'text', required: true, max: 200 },
    { name: 'workMode', label: 'Work mode', type: 'select', required: true, options: workModes },
    { name: 'jobUrl', label: 'Job link (HTTPS)', type: 'url', required: true, max: 2048 },
    { name: 'description', label: 'Opportunity details', type: 'textarea', required: true, max: 2000 },
    { name: 'experienceMin', label: 'Minimum years of experience', type: 'number' },
    { name: 'experienceMax', label: 'Maximum years of experience', type: 'number' },
    { name: 'requiredSkills', label: 'Required skills (comma separated)', type: 'text', max: 500 },
    { name: 'expiresAt', label: 'Expires at', type: 'datetime-local' }
  ],
  needreferral: [
    { name: 'jobTitle', label: 'Job title', type: 'text', required: true, max: 120 },
    { name: 'company', label: 'Company', type: 'text', required: true, max: 120 },
    { name: 'jobUrl', label: 'Job link (HTTPS)', type: 'url', max: 2048 },
    {
      name: 'experienceLevel',
      label: 'Experience level',
      type: 'select',
      required: true,
      options: [
        { value: 'entry', label: 'Entry' },
        { value: 'mid', label: 'Mid' },
        { value: 'senior', label: 'Senior' }
      ]
    },
    { name: 'skills', label: 'Relevant skills (comma separated)', type: 'text', max: 500 },
    { name: 'message', label: 'Referral request', type: 'textarea', required: true, max: 2000 }
  ],
  event: [
    { name: 'title', label: 'Event title', type: 'text', required: true, max: 160 },
    { name: 'category', label: 'Category', type: 'text', max: 80 },
    { name: 'description', label: 'Event details', type: 'textarea', required: true, max: 2000 },
    { name: 'startAt', label: 'Starts at', type: 'datetime-local', required: true },
    { name: 'endAt', label: 'Ends at', type: 'datetime-local' },
    { name: 'timezone', label: 'IANA time zone', type: 'text', required: true, max: 100 },
    { name: 'locationType', label: 'Location type', type: 'select', required: true, options: locationTypes },
    { name: 'locationOrUrl', label: 'Venue or HTTPS link', type: 'text', required: true, max: 200 },
    { name: 'onlineUrl', label: 'Hybrid online link (HTTPS)', type: 'url', max: 2048 },
    { name: 'capacity', label: 'Capacity', type: 'number' },
    {
      name: 'registrationOpen',
      label: 'Registration',
      type: 'select',
      options: [
        { value: 'true', label: 'Open' },
        { value: 'false', label: 'Closed' }
      ]
    }
  ],
  meetup: [
    { name: 'title', label: 'Meetup title', type: 'text', required: true, max: 160 },
    { name: 'description', label: 'Meetup details', type: 'textarea', required: true, max: 2000 },
    { name: 'scheduledAt', label: 'Scheduled for', type: 'datetime-local', required: true },
    { name: 'timezone', label: 'IANA time zone', type: 'text', required: true, max: 100 },
    { name: 'locationType', label: 'Location type', type: 'select', required: true, options: locationTypes },
    { name: 'locationOrUrl', label: 'Venue or HTTPS link', type: 'text', required: true, max: 200 },
    { name: 'onlineUrl', label: 'Hybrid online link (HTTPS)', type: 'url', max: 2048 },
    { name: 'capacity', label: 'Capacity', type: 'number' }
  ]
};

export default function CommandForm({
  command,
  communityId,
  onCancel,
  onSuccess
}: {
  command: CommandMetadata;
  communityId: string;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const first = useRef<HTMLInputElement>(null);
  const dateInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [values, setValues] = useState<Record<string, string>>({
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  });
  const idempotencyKey = useRef(crypto.randomUUID());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { submit } = useCommandActions(communityId);
  useEffect(() => first.current?.focus(), [command.id]);
  const save = (event: FormEvent) => {
    event.preventDefault();
    const payload: Record<string, unknown> = {};
    for (const field of fields[command.id]) {
      const value = values[field.name]?.trim() ?? '';
      if (!value && !field.required) continue;
      if (field.type === 'datetime-local') {
        if (command.id === 'event' || command.id === 'meetup') {
          try {
            payload[field.name] = zonedDateTime(value, values.timezone || 'UTC');
          } catch (error) {
            setErrors({ [field.name]: error instanceof Error ? error.message : 'Invalid time.' });
            dateInputs.current[field.name]?.focus();
            return;
          }
        } else {
          const date = new Date(value);
          payload[field.name] = Number.isFinite(date.getTime()) ? date.toISOString() : value;
        }
      } else if (field.name === 'requiredSkills' || field.name === 'skills')
        payload[field.name] = value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
      else if (field.name === 'tags')
        payload[field.name] = value
          .split(',')
          .map((item) => item.trim().toLowerCase().replace(/\s+/g, '-'))
          .filter(Boolean);
      else if (field.type === 'number') payload[field.name] = Number(value);
      else if (field.name === 'registrationOpen') payload[field.name] = value === 'true';
      else payload[field.name] = value;
    }
    const parsed = commandPayloadSchemas[command.id].safeParse(payload);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]))
      );
      const firstInvalid = String(parsed.error.issues[0]?.path[0] ?? '');
      document.getElementById(`command-${firstInvalid}`)?.focus();
      return;
    }
    setErrors({});
    submit.mutate(
      {
        command: command.id,
        payloadVersion: command.payloadVersion,
        payload: parsed.data,
        ...(command.id === 'event' || command.id === 'meetup'
          ? { idempotencyKey: idempotencyKey.current }
          : {})
      } as CommandSubmission,
      { onSuccess }
    );
  };
  return (
    <form className="command-form" onSubmit={save} noValidate aria-labelledby="command-form-title">
      <header>
        <h3 id="command-form-title">{command.label}</h3>
        <p>{command.description}</p>
      </header>
      {Object.keys(errors).length > 0 && (
        <p className="command-form-validation" role="alert">
          Please correct the highlighted fields before publishing.
        </p>
      )}
      <div className="command-form-fields">
        {fields[command.id].map((field, index) => (
          <label key={field.name} htmlFor={`command-${field.name}`}>
            {field.label}
            {field.required && <span aria-hidden="true"> *</span>}
            {field.type === 'textarea' ? (
              <textarea
                id={`command-${field.name}`}
                rows={4}
                required={field.required}
                maxLength={field.max}
                value={values[field.name] ?? ''}
                aria-invalid={!!errors[field.name]}
                aria-describedby={errors[field.name] ? `command-error-${field.name}` : undefined}
                onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
              />
            ) : field.type === 'select' ? (
              <select
                id={`command-${field.name}`}
                value={values[field.name] ?? ''}
                required={field.required}
                aria-invalid={!!errors[field.name]}
                aria-describedby={errors[field.name] ? `command-error-${field.name}` : undefined}
                onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
              >
                <option value="">Choose…</option>
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.type === 'datetime-local' ? (
              <span className="command-date-field">
                <input
                  ref={(element) => {
                    dateInputs.current[field.name] = element;
                  }}
                  id={`command-${field.name}`}
                  type="datetime-local"
                  required={field.required}
                  value={values[field.name] ?? ''}
                  aria-invalid={!!errors[field.name]}
                  aria-describedby={errors[field.name] ? `command-error-${field.name}` : undefined}
                  onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
                />
                <button
                  type="button"
                  aria-label={`Choose ${field.label.toLowerCase()} date and time`}
                  title="Open calendar"
                  onClick={() => {
                    const dateInput = dateInputs.current[field.name];
                    if (!dateInput) return;
                    try {
                      dateInput.showPicker();
                    } catch {
                      dateInput.focus();
                    }
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M7 3v4m10-4v4M3 10h18m-13 4h3m3 0h3" />
                  </svg>
                </button>
              </span>
            ) : (
              <input
                ref={index === 0 ? first : undefined}
                id={`command-${field.name}`}
                type={field.type}
                required={field.required}
                maxLength={field.max}
                min={field.type === 'number' ? (field.name === 'capacity' ? 1 : 0) : undefined}
                max={field.type === 'number' ? (field.name === 'capacity' ? 10000 : 60) : undefined}
                value={values[field.name] ?? ''}
                aria-invalid={!!errors[field.name]}
                aria-describedby={errors[field.name] ? `command-error-${field.name}` : undefined}
                onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
              />
            )}
            {errors[field.name] && (
              <span id={`command-error-${field.name}`} className="command-error">
                {errors[field.name]}
              </span>
            )}
          </label>
        ))}
      </div>
      {submit.isError && (
        <p className="command-error" role="alert">
          {apiErrorMessage(submit.error)}
        </p>
      )}
      <div className="command-form-actions">
        <button type="button" className="community-action" onClick={onCancel} disabled={submit.isPending}>
          Cancel
        </button>
        <button type="submit" className="community-primary" disabled={submit.isPending}>
          {submit.isPending ? 'Publishing…' : 'Publish activity'}
        </button>
      </div>
    </form>
  );
}
