import {
  needReferralPayloadSchema,
  referralPayloadSchema,
  type NeedReferralPayload,
  type ReferralPayload
} from '@voklance/shared';
import { useState, type FormEvent } from 'react';
import { apiErrorMessage } from '@/lib/apiClient';
import { useReferralActions } from '../hooks/useReferrals';

type Field = {
  name: string;
  label: string;
  type: 'text' | 'url' | 'textarea' | 'number' | 'select' | 'datetime-local';
  required?: boolean;
  options?: string[];
  max?: number;
};
const opportunityFields: Field[] = [
  { name: 'jobTitle', label: 'Job title', type: 'text', required: true, max: 120 },
  { name: 'company', label: 'Company', type: 'text', required: true, max: 120 },
  { name: 'location', label: 'Location', type: 'text', required: true, max: 200 },
  {
    name: 'workMode',
    label: 'Work mode',
    type: 'select',
    required: true,
    options: ['remote', 'hybrid', 'onsite']
  },
  { name: 'jobUrl', label: 'Job URL (HTTPS)', type: 'url', required: true, max: 2048 },
  { name: 'description', label: 'Description', type: 'textarea', required: true, max: 2000 },
  { name: 'experienceMin', label: 'Minimum years of experience', type: 'number' },
  { name: 'experienceMax', label: 'Maximum years of experience', type: 'number' },
  { name: 'requiredSkills', label: 'Required skills (comma separated)', type: 'text', max: 500 },
  { name: 'expiresAt', label: 'Expires at', type: 'datetime-local' }
];
const needFields: Field[] = [
  { name: 'jobTitle', label: 'Job title', type: 'text', required: true, max: 120 },
  { name: 'company', label: 'Company', type: 'text', required: true, max: 120 },
  { name: 'jobUrl', label: 'Job URL (HTTPS)', type: 'url', max: 2048 },
  {
    name: 'experienceLevel',
    label: 'Experience level',
    type: 'select',
    required: true,
    options: ['entry', 'mid', 'senior']
  },
  { name: 'skills', label: 'Relevant skills (comma separated)', type: 'text', max: 500 },
  { name: 'message', label: 'Request description', type: 'textarea', required: true, max: 2000 }
];
function localDate(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
export default function ReferralDetailsEditor({
  kind,
  id,
  initial,
  onCancel,
  onSuccess
}: {
  kind: 'opportunity' | 'need';
  id: string;
  initial: ReferralPayload | NeedReferralPayload;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(initial).map(([key, value]) => [
        key,
        Array.isArray(value)
          ? value.join(', ')
          : key === 'expiresAt' && typeof value === 'string'
            ? localDate(value)
            : String(value)
      ])
    )
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const actions = useReferralActions();
  const action = kind === 'opportunity' ? actions.updateOpportunity : actions.updateNeed;
  const fields = kind === 'opportunity' ? opportunityFields : needFields;
  const save = (event: FormEvent) => {
    event.preventDefault();
    const payload: Record<string, unknown> = {};
    for (const field of fields) {
      const value = values[field.name]?.trim() ?? '';
      if (!value && !field.required) continue;
      if (field.name === 'requiredSkills' || field.name === 'skills')
        payload[field.name] = value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
      else if (field.type === 'number') payload[field.name] = Number(value);
      else if (field.type === 'datetime-local') payload[field.name] = new Date(value).toISOString();
      else payload[field.name] = value;
    }
    const parsed = (kind === 'opportunity' ? referralPayloadSchema : needReferralPayloadSchema).safeParse(
      payload
    );
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]))
      );
      return;
    }
    setErrors({});
    if (kind === 'opportunity')
      actions.updateOpportunity.mutate({ id, details: referralPayloadSchema.parse(payload) }, { onSuccess });
    else actions.updateNeed.mutate({ id, details: needReferralPayloadSchema.parse(payload) }, { onSuccess });
  };
  return (
    <form className="referral-form" onSubmit={save} noValidate>
      <h2>Edit {kind === 'opportunity' ? 'opportunity' : 'request'}</h2>
      {fields.map((field) => (
        <div key={field.name}>
          <label>
            {field.label}
            {field.required && ' *'}
            {field.type === 'textarea' ? (
              <textarea
                rows={4}
                maxLength={field.max}
                value={values[field.name] ?? ''}
                onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
                aria-invalid={!!errors[field.name]}
              />
            ) : field.type === 'select' ? (
              <select
                value={values[field.name] ?? ''}
                onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
                aria-invalid={!!errors[field.name]}
              >
                {field.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.type}
                maxLength={field.max}
                min={field.type === 'number' ? 0 : undefined}
                max={field.type === 'number' ? 60 : undefined}
                value={values[field.name] ?? ''}
                onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
                aria-invalid={!!errors[field.name]}
              />
            )}
          </label>
          {errors[field.name] && <p className="referral-field-error">{errors[field.name]}</p>}
        </div>
      ))}
      {action.isError && (
        <p role="alert" className="referral-field-error">
          {apiErrorMessage(action.error)}
        </p>
      )}
      <div className="referral-actions">
        <button type="button" className="community-action" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="community-primary" disabled={action.isPending}>
          {action.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
