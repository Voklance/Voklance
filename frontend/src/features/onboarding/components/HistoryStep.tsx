import { useEffect, useState, type FormEvent } from 'react';
import type { Education, ProfessionalExperience } from '@voklance/shared';
import { apiErrorMessage } from '@/lib/apiClient';
import { useHistory } from '../hooks/useHistory';
import {
  educationSchema,
  experienceSchema,
  fieldErrors,
  type EducationDraft,
  type ExperienceDraft
} from '../validation/onboardingSchemas';

const emptyExperience: ExperienceDraft = {
  jobTitle: '',
  companyName: '',
  employmentType: '',
  startDate: '',
  endDate: '',
  isCurrent: false,
  description: ''
};
const emptyEducation: EducationDraft = {
  institution: '',
  degree: '',
  fieldOfStudy: '',
  startDate: '',
  endDate: ''
};

export default function HistoryStep({
  experiences,
  education,
  onDirtyChange,
  confirmDeletion = false
}: {
  experiences: ProfessionalExperience[];
  education: Education[];
  onDirtyChange: (dirty: boolean) => void;
  confirmDeletion?: boolean;
}) {
  const actions = useHistory();
  const [experience, setExperience] = useState<ExperienceDraft>(emptyExperience);
  const [educationDraft, setEducationDraft] = useState<EducationDraft>(emptyEducation);
  const [experienceId, setExperienceId] = useState<string | null>(null);
  const [educationId, setEducationId] = useState<string | null>(null);
  const [experienceErrors, setExperienceErrors] = useState<Record<string, string>>({});
  const [educationErrors, setEducationErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const pending = Object.values(actions).some((action) => action.isPending);
  const experienceDirty =
    !!experienceId ||
    Object.entries(experience).some(
      ([key, value]) => value !== emptyExperience[key as keyof ExperienceDraft]
    );
  const educationDirty =
    !!educationId ||
    Object.entries(educationDraft).some(
      ([key, value]) => value !== emptyEducation[key as keyof EducationDraft]
    );
  useEffect(() => {
    onDirtyChange(experienceDirty || educationDirty);
  }, [experienceDirty, educationDirty, onDirtyChange]);

  async function saveExperience(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const parsed = experienceSchema.safeParse(experience);
    if (!parsed.success) {
      setExperienceErrors(fieldErrors(parsed.error));
      return;
    }
    setExperienceErrors({});
    setMessage('');
    const input = {
      jobTitle: parsed.data.jobTitle,
      companyName: parsed.data.companyName,
      employmentType: parsed.data.employmentType || undefined,
      startDate: parsed.data.startDate,
      endDate: parsed.data.isCurrent ? null : parsed.data.endDate || null,
      isCurrent: parsed.data.isCurrent,
      description: parsed.data.description || undefined
    };
    try {
      if (experienceId) await actions.editExperience.mutateAsync({ id: experienceId, input });
      else await actions.addExperience.mutateAsync(input);
      setExperience(emptyExperience);
      setExperienceId(null);
    } catch (error) {
      setMessage(apiErrorMessage(error));
    }
  }
  async function saveEducation(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const parsed = educationSchema.safeParse(educationDraft);
    if (!parsed.success) {
      setEducationErrors(fieldErrors(parsed.error));
      return;
    }
    setEducationErrors({});
    setMessage('');
    const input = {
      institution: parsed.data.institution,
      degree: parsed.data.degree || undefined,
      fieldOfStudy: parsed.data.fieldOfStudy || undefined,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate || null
    };
    try {
      if (educationId) await actions.editEducation.mutateAsync({ id: educationId, input });
      else await actions.addEducation.mutateAsync(input);
      setEducationDraft(emptyEducation);
      setEducationId(null);
    } catch (error) {
      setMessage(apiErrorMessage(error));
    }
  }
  function editExperience(item: ProfessionalExperience) {
    setExperienceId(item.id);
    setExperience({
      jobTitle: item.jobTitle,
      companyName: item.companyName,
      employmentType: item.employmentType || '',
      startDate: item.startDate,
      endDate: item.endDate || '',
      isCurrent: item.isCurrent,
      description: item.description || ''
    });
    setExperienceErrors({});
  }
  function editEducation(item: Education) {
    setEducationId(item.id);
    setEducationDraft({
      institution: item.institution,
      degree: item.degree || '',
      fieldOfStudy: item.fieldOfStudy || '',
      startDate: item.startDate,
      endDate: item.endDate || ''
    });
    setEducationErrors({});
  }
  async function remove(kind: 'experience' | 'education', id: string) {
    if (pending) return;
    if (confirmDeletion && !window.confirm(`Remove this ${kind} record?`)) return;
    setMessage('');
    try {
      if (kind === 'experience') await actions.removeExperience.mutateAsync(id);
      else await actions.removeEducation.mutateAsync(id);
      if (kind === 'experience' && experienceId === id) {
        setExperienceId(null);
        setExperience(emptyExperience);
      }
      if (kind === 'education' && educationId === id) {
        setEducationId(null);
        setEducationDraft(emptyEducation);
      }
    } catch (error) {
      setMessage(apiErrorMessage(error));
    }
  }
  return (
    <div className="history-sections">
      <p className="onboarding-hint">
        Experience and education are optional. You can continue without adding either.
      </p>
      {message && (
        <p className="onboarding-alert" role="alert">
          {message}
        </p>
      )}
      <section aria-labelledby="experience-heading">
        <h3 id="experience-heading">Professional experience</h3>
        {experiences.length === 0 ? (
          <p className="onboarding-empty">No experience added yet.</p>
        ) : (
          <ul className="history-list">
            {experiences.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.jobTitle}</strong>
                  <span>
                    {item.companyName}, {item.startDate}
                    {item.endDate ? ` – ${item.endDate}` : item.isCurrent ? ' – Present' : ''}
                  </span>
                </div>
                <div>
                  <button type="button" onClick={() => editExperience(item)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void remove('experience', item.id)}
                    aria-label={`Remove ${item.jobTitle}`}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={(event) => void saveExperience(event)} className="onboarding-history-form">
          <h4>{experienceId ? 'Edit experience' : 'Add experience'}</h4>
          <div className="onboarding-form-grid">
            <Field
              id="jobTitle"
              label="Job title"
              value={experience.jobTitle}
              error={experienceErrors.jobTitle}
              onChange={(value) => setExperience({ ...experience, jobTitle: value })}
            />
            <Field
              id="companyName"
              label="Organization"
              value={experience.companyName}
              error={experienceErrors.companyName}
              onChange={(value) => setExperience({ ...experience, companyName: value })}
            />
            <Field
              id="employmentType"
              label="Employment type"
              value={experience.employmentType}
              error={experienceErrors.employmentType}
              onChange={(value) => setExperience({ ...experience, employmentType: value })}
              optional
            />
            <Field
              id="experienceStartDate"
              label="Experience start date"
              type="date"
              value={experience.startDate}
              error={experienceErrors.startDate}
              onChange={(value) => setExperience({ ...experience, startDate: value })}
            />
            <Field
              id="experienceEndDate"
              label="Experience end date"
              type="date"
              value={experience.endDate}
              error={experienceErrors.endDate}
              disabled={experience.isCurrent}
              onChange={(value) => setExperience({ ...experience, endDate: value })}
              optional
            />
            <label className="history-checkbox">
              <input
                type="checkbox"
                checked={experience.isCurrent}
                onChange={(event) =>
                  setExperience({
                    ...experience,
                    isCurrent: event.target.checked,
                    endDate: event.target.checked ? '' : experience.endDate
                  })
                }
              />{' '}
              Currently working here
            </label>
            <div className="onboarding-field onboarding-wide">
              <label htmlFor="experienceDescription">
                Description <span>Optional</span>
              </label>
              <textarea
                id="experienceDescription"
                rows={3}
                maxLength={2000}
                value={experience.description}
                onChange={(event) => setExperience({ ...experience, description: event.target.value })}
              />
            </div>
          </div>
          <div className="history-actions">
            <button
              className="onboarding-secondary-button"
              type="submit"
              disabled={pending || (experiences.length >= 50 && !experienceId)}
            >
              {experienceId ? 'Save experience' : 'Add experience'}
            </button>
            {experienceDirty && (
              <button
                type="button"
                onClick={() => {
                  setExperienceId(null);
                  setExperience(emptyExperience);
                  setExperienceErrors({});
                }}
              >
                {experienceId ? 'Cancel edit' : 'Clear form'}
              </button>
            )}
          </div>
        </form>
      </section>
      <section aria-labelledby="education-heading">
        <h3 id="education-heading">Education</h3>
        {education.length === 0 ? (
          <p className="onboarding-empty">No education added yet.</p>
        ) : (
          <ul className="history-list">
            {education.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.institution}</strong>
                  <span>
                    {item.degree || 'Education'}, {item.startDate}
                    {item.endDate ? ` – ${item.endDate}` : ''}
                  </span>
                </div>
                <div>
                  <button type="button" onClick={() => editEducation(item)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void remove('education', item.id)}
                    aria-label={`Remove ${item.institution}`}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={(event) => void saveEducation(event)} className="onboarding-history-form">
          <h4>{educationId ? 'Edit education' : 'Add education'}</h4>
          <div className="onboarding-form-grid">
            <Field
              id="institution"
              label="Institution"
              value={educationDraft.institution}
              error={educationErrors.institution}
              onChange={(value) => setEducationDraft({ ...educationDraft, institution: value })}
            />
            <Field
              id="degree"
              label="Degree"
              value={educationDraft.degree}
              error={educationErrors.degree}
              onChange={(value) => setEducationDraft({ ...educationDraft, degree: value })}
              optional
            />
            <Field
              id="fieldOfStudy"
              label="Field of study"
              value={educationDraft.fieldOfStudy}
              error={educationErrors.fieldOfStudy}
              onChange={(value) => setEducationDraft({ ...educationDraft, fieldOfStudy: value })}
              optional
            />
            <Field
              id="educationStartDate"
              label="Education start date"
              type="date"
              value={educationDraft.startDate}
              error={educationErrors.startDate}
              onChange={(value) => setEducationDraft({ ...educationDraft, startDate: value })}
            />
            <Field
              id="educationEndDate"
              label="Education end date"
              type="date"
              value={educationDraft.endDate}
              error={educationErrors.endDate}
              onChange={(value) => setEducationDraft({ ...educationDraft, endDate: value })}
              optional
            />
          </div>
          <div className="history-actions">
            <button
              className="onboarding-secondary-button"
              type="submit"
              disabled={pending || (education.length >= 50 && !educationId)}
            >
              {educationId ? 'Save education' : 'Add education'}
            </button>
            {educationDirty && (
              <button
                type="button"
                onClick={() => {
                  setEducationId(null);
                  setEducationDraft(emptyEducation);
                  setEducationErrors({});
                }}
              >
                {educationId ? 'Cancel edit' : 'Clear form'}
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  type = 'text',
  optional,
  disabled
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  optional?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="onboarding-field">
      <label htmlFor={id}>
        {label}
        {optional && <span>Optional</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={`${id}-error`}
        onChange={(event) => onChange(event.target.value)}
      />
      <p id={`${id}-error`} className="onboarding-error">
        {error}
      </p>
    </div>
  );
}
