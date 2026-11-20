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

function displayDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function HistoryIcon({ kind }: { kind: 'experience' | 'education' }) {
  return (
    <span className="history-record-icon" aria-hidden="true">
      <span className="history-record-icon-tile">
        {kind === 'experience' ? (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 21V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14M2 21h20M9 21v-5h6v5M8 9h2m4 0h2M8 12h2m4 0h2" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m2 9 10-5 10 5-10 5L2 9Z" />
            <path d="M6 11v5c2 3 10 3 12 0v-5M22 9v6" />
          </svg>
        )}
      </span>
    </span>
  );
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4M17 3v4M3 10h18" />
    </svg>
  );
}

function HistoryActionIcon({ action }: { action: 'edit' | 'remove' }) {
  return action === 'edit' ? (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m15.5 5.5 3 3M4 20l4.2-.9L19 8.3a2.1 2.1 0 0 0-3-3L5.2 16.1 4 20Z" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
    </svg>
  );
}

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
  const [showExperienceForm, setShowExperienceForm] = useState(experiences.length === 0);
  const [showEducationForm, setShowEducationForm] = useState(education.length === 0);
  const [experienceErrors, setExperienceErrors] = useState<Record<string, string>>({});
  const [educationErrors, setEducationErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const pending = Object.values(actions).some((action) => action.isPending);
  const experienceFormOpen = experiences.length === 0 || showExperienceForm || !!experienceId;
  const educationFormOpen = education.length === 0 || showEducationForm || !!educationId;
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
      setShowExperienceForm(false);
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
      setShowEducationForm(false);
    } catch (error) {
      setMessage(apiErrorMessage(error));
    }
  }
  function editExperience(item: ProfessionalExperience) {
    setShowExperienceForm(true);
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
    setShowEducationForm(true);
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
        setShowExperienceForm(false);
      }
      if (kind === 'education' && educationId === id) {
        setEducationId(null);
        setEducationDraft(emptyEducation);
        setShowEducationForm(false);
      }
    } catch (error) {
      setMessage(apiErrorMessage(error));
    }
  }
  return (
    <div className="history-sections">
      {message && (
        <p className="onboarding-alert" role="alert">
          {message}
        </p>
      )}
      <section aria-labelledby="experience-heading">
        <div className="history-section-heading">
          <div className="history-section-heading-copy">
            <h3 id="experience-heading">Professional Experience</h3>
            <p>Add your work experience, internships, or relevant projects.</p>
          </div>
          {experiences.length > 0 && !experienceFormOpen && experiences.length < 50 && (
            <button
              type="button"
              className="history-add-button"
              disabled={pending}
              onClick={() => {
                setExperience(emptyExperience);
                setExperienceId(null);
                setExperienceErrors({});
                setShowExperienceForm(true);
              }}
            >
              <span aria-hidden="true">+</span> Add Experience
            </button>
          )}
        </div>
        {experiences.length > 0 && (
          <ul className="history-list">
            {experiences.map((item) => (
              <li key={item.id}>
                <HistoryIcon kind="experience" />
                <div className="history-record-details">
                  <div className="history-record-title">
                    <strong>{item.jobTitle}</strong>
                    {item.isCurrent && <span className="history-record-current">Current</span>}
                  </div>
                  <span className="history-record-organization">{item.companyName}</span>
                  <span className="history-record-period">
                    <CalendarIcon />
                    {displayDate(item.startDate)}
                    {item.isCurrent ? ' – Present' : item.endDate ? ` – ${displayDate(item.endDate)}` : ''}
                  </span>
                </div>
                <div className="history-record-actions">
                  <button
                    type="button"
                    className="history-record-action"
                    aria-label={`Edit ${item.jobTitle}`}
                    title={`Edit ${item.jobTitle}`}
                    disabled={pending}
                    onClick={() => editExperience(item)}
                  >
                    <HistoryActionIcon action="edit" />
                  </button>
                  <button
                    type="button"
                    className="history-record-action history-record-action--remove"
                    title={`Remove ${item.jobTitle}`}
                    disabled={pending}
                    onClick={() => void remove('experience', item.id)}
                    aria-label={`Remove ${item.jobTitle}`}
                  >
                    <HistoryActionIcon action="remove" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {experienceFormOpen && (
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
                aria-label={experienceId ? 'Save experience' : 'Submit experience'}
                disabled={pending || (experiences.length >= 50 && !experienceId)}
              >
                {experienceId ? 'Save experience' : 'Submit'}
              </button>
              {(experienceDirty || experiences.length > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    setExperienceId(null);
                    setExperience(emptyExperience);
                    setExperienceErrors({});
                    if (experiences.length > 0) setShowExperienceForm(false);
                  }}
                >
                  {experienceId ? 'Cancel edit' : experiences.length > 0 ? 'Cancel' : 'Clear form'}
                </button>
              )}
            </div>
          </form>
        )}
      </section>
      <section aria-labelledby="education-heading">
        <div className="history-section-heading">
          <div className="history-section-heading-copy">
            <h3 id="education-heading">Education</h3>
            <p>Add your highest degree or relevant qualifications.</p>
          </div>
          {education.length > 0 && !educationFormOpen && education.length < 50 && (
            <button
              type="button"
              className="history-add-button"
              disabled={pending}
              onClick={() => {
                setEducationDraft(emptyEducation);
                setEducationId(null);
                setEducationErrors({});
                setShowEducationForm(true);
              }}
            >
              <span aria-hidden="true">+</span> Add Education
            </button>
          )}
        </div>
        {education.length > 0 && (
          <ul className="history-list">
            {education.map((item) => (
              <li key={item.id}>
                <HistoryIcon kind="education" />
                <div className="history-record-details">
                  <div className="history-record-title">
                    <strong>{item.institution}</strong>
                  </div>
                  {item.degree && <span className="history-record-organization">{item.degree}</span>}
                  <span className="history-record-period">
                    <CalendarIcon />
                    {displayDate(item.startDate)}
                    {item.endDate ? ` – ${displayDate(item.endDate)}` : ''}
                  </span>
                </div>
                <div className="history-record-actions">
                  <button
                    type="button"
                    className="history-record-action"
                    aria-label={`Edit ${item.institution}`}
                    title={`Edit ${item.institution}`}
                    disabled={pending}
                    onClick={() => editEducation(item)}
                  >
                    <HistoryActionIcon action="edit" />
                  </button>
                  <button
                    type="button"
                    className="history-record-action history-record-action--remove"
                    title={`Remove ${item.institution}`}
                    disabled={pending}
                    onClick={() => void remove('education', item.id)}
                    aria-label={`Remove ${item.institution}`}
                  >
                    <HistoryActionIcon action="remove" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {educationFormOpen && (
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
                aria-label={educationId ? 'Save education' : 'Submit education'}
                disabled={pending || (education.length >= 50 && !educationId)}
              >
                {educationId ? 'Save education' : 'Submit'}
              </button>
              {(educationDirty || education.length > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    setEducationId(null);
                    setEducationDraft(emptyEducation);
                    setEducationErrors({});
                    if (education.length > 0) setShowEducationForm(false);
                  }}
                >
                  {educationId ? 'Cancel edit' : education.length > 0 ? 'Cancel' : 'Clear form'}
                </button>
              )}
            </div>
          </form>
        )}
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
