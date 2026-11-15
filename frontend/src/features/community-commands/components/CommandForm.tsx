import {
  commandPayloadSchemas,
  type CommandId,
  type CommandMetadata,
  type CommandSubmission
} from '@voklance/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiErrorMessage } from '@/lib/apiClient';
import { useCommandActions } from '../hooks/useCommunityCommands';

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
    { name: 'description', label: 'Event details', type: 'textarea', required: true, max: 2000 },
    { name: 'startAt', label: 'Starts at', type: 'datetime-local', required: true },
    { name: 'endAt', label: 'Ends at', type: 'datetime-local' },
    { name: 'locationType', label: 'Location type', type: 'select', required: true, options: locationTypes },
    { name: 'locationOrUrl', label: 'Location or HTTPS link', type: 'text', required: true, max: 200 }
  ],
  meetup: [
    { name: 'title', label: 'Meetup title', type: 'text', required: true, max: 160 },
    { name: 'description', label: 'Meetup details', type: 'textarea', required: true, max: 2000 },
    { name: 'scheduledAt', label: 'Scheduled for', type: 'datetime-local', required: true },
    { name: 'locationType', label: 'Location type', type: 'select', required: true, options: locationTypes },
    { name: 'locationOrUrl', label: 'Location or HTTPS link', type: 'text', required: true, max: 200 },
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
  const [values, setValues] = useState<Record<string, string>>({});
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
        const date = new Date(value);
        payload[field.name] = Number.isFinite(date.getTime()) ? date.toISOString() : value;
      } else if (field.name === 'requiredSkills' || field.name === 'skills')
        payload[field.name] = value.split(',').map((item) => item.trim()).filter(Boolean);
      else if (field.type === 'number') payload[field.name] = Number(value);
      else payload[field.name] = value;
    }
    const parsed = commandPayloadSchemas[command.id].safeParse(payload);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]))
      );
      return;
    }
    setErrors({});
    submit.mutate(
      {
        command: command.id,
        payloadVersion: command.payloadVersion,
        payload: parsed.data
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
      <div className="command-form-fields">
        {fields[command.id].map((field, index) => (
          <label key={field.name} htmlFor={`command-${field.name}`}>
            {field.label}
            {field.required && <span aria-hidden="true"> *</span>}
            {field.type === 'textarea' ? (
              <textarea
                id={`command-${field.name}`}
                rows={4}
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
            ) : (
              <input
                ref={index === 0 ? first : undefined}
                id={`command-${field.name}`}
                type={field.type}
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
