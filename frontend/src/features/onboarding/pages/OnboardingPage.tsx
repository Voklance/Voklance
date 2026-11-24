import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import axios from 'axios';
import type { CatalogItem, OnboardingSnapshot, OnboardingStep, ProfessionalStatus } from '@voklance/shared';
import ErrorState from '@/components/shared/ErrorState';
import { useFlash } from '@/components/shared/FlashMessages';
import LoadingState from '@/components/shared/LoadingState';
import { currentUserKey } from '@/features/auth/hooks/useCurrentUser';
import { authApi } from '@/features/auth/api/authApi';
import { apiErrorMessage } from '@/lib/apiClient';
import CatalogSelector from '../components/CatalogSelector';
import HistoryStep from '../components/HistoryStep';
import OnboardingLayout from '../components/OnboardingLayout';
import OnboardingProgress, { stepNames } from '../components/OnboardingProgress';
import ProfileStep from '../components/ProfileStep';
import ProfessionalStatusStep, { professionalStatusLabels } from '../components/ProfessionalStatusStep';
import { useInterestsCatalog, useOnboarding, useSkillsCatalog } from '../hooks/useOnboarding';
import {
  fieldErrors,
  onboardingIdentitySchema,
  statusSchema,
  type IdentityDraft
} from '../validation/onboardingSchemas';

const blankIdentity: IdentityDraft = {
  firstName: '',
  lastName: '',
  headline: ''
};

function problem(error: unknown) {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) return 'Your session has expired. Sign in again to continue.';
    if (error.response?.status === 503)
      return 'The database is unavailable. Your unsaved changes are still here; try again shortly.';
    if (error.response?.status === 429) return 'Too many requests. Please wait a moment and try again.';
    if (error.response?.status === 403)
      return 'This request was not allowed. Refresh the page and try again.';
    if (error.response?.status === 404) return 'This item is no longer available. Refresh and try again.';
    if (error.response?.status && error.response.status >= 500)
      return 'Something went wrong. Please try again.';
  }
  return apiErrorMessage(error);
}

function useDebounced(value: string) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), 250);
    return () => window.clearTimeout(timer);
  }, [value]);
  return debounced;
}

export default function OnboardingPage() {
  const data = useOnboarding();
  if (data.progress.isPending)
    return (
      <OnboardingLayout>
        <LoadingState label="Loading your onboarding progress…" />
      </OnboardingLayout>
    );
  if (data.progress.isError)
    return (
      <OnboardingLayout>
        <ErrorState message={problem(data.progress.error)} onRetry={() => void data.progress.refetch()} />
      </OnboardingLayout>
    );
  return (
    <OnboardingLayout>
      <OnboardingWizard initial={data.progress.data.onboarding} onboarding={data} />
    </OnboardingLayout>
  );
}

type OnboardingState = ReturnType<typeof useOnboarding>;

function OnboardingWizard({
  initial,
  onboarding
}: {
  initial: OnboardingSnapshot;
  onboarding: OnboardingState;
}) {
  const navigate = useNavigate();
  const { showFlash } = useFlash();
  const [snapshot, setSnapshot] = useState(initial);
  const [step, setStep] = useState<OnboardingStep>(initial.currentStep);
  const [identity, setIdentity] = useState<IdentityDraft>(() => ({
    ...blankIdentity,
    firstName: initial.profile?.firstName || '',
    lastName: initial.profile?.lastName || '',
    headline: initial.profile?.headline || ''
  }));
  const [status, setStatus] = useState<ProfessionalStatus | ''>(initial.profile?.professionalStatus || '');
  const [skills, setSkills] = useState<CatalogItem[]>(initial.skills);
  const [interests, setInterests] = useState<CatalogItem[]>(initial.interests);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [skillSearch, setSkillSearch] = useState('');
  const [interestSearch, setInterestSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [historyDirty, setHistoryDirty] = useState(false);
  const busy = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const debouncedSkillSearch = useDebounced(skillSearch);
  const debouncedInterestSearch = useDebounced(interestSearch);
  const skillCatalog = useSkillsCatalog(debouncedSkillSearch, step === 3);
  const interestCatalog = useInterestsCatalog(debouncedInterestSearch, step === 5);
  const history = {
    experiences: onboarding.experiences.data?.experiences || snapshot.experiences,
    education: onboarding.educations.data?.educations || snapshot.education
  };

  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  useEffect(() => {
    if (onboarding.progress.data?.onboarding) setSnapshot(onboarding.progress.data.onboarding);
  }, [onboarding.progress.data]);
  const historyChanged = useCallback((value: boolean) => setHistoryDirty(value), []);

  async function persistCurrent() {
    if (step === 1) {
      const parsed = onboardingIdentitySchema.safeParse(identity);
      if (!parsed.success) {
        setErrors(fieldErrors(parsed.error));
        showFlash({ type: 'warning', message: 'Please complete the required profile fields.' });
        return false;
      }
      await onboarding.saveIdentity.mutateAsync(parsed.data);
      setIdentity(parsed.data);
      setErrors({});
    } else if (step === 2) {
      const parsed = statusSchema.safeParse(status);
      if (!parsed.success) {
        setErrors({ status: 'Choose a professional status.' });
        showFlash({ type: 'warning', message: 'Please choose your professional status.' });
        return false;
      }
      await onboarding.saveProfile.mutateAsync({ professionalStatus: parsed.data });
      setErrors({});
    } else if (step === 3) {
      if (!skills.length) {
        setErrors({ skills: 'Select at least one skill.' });
        showFlash({ type: 'warning', message: 'Please select at least one skill.' });
        return false;
      }
      await onboarding.saveSkills.mutateAsync({ skillIds: skills.map((item) => item.id) });
      setErrors({});
    } else if (step === 5) {
      if (!interests.length) {
        setErrors({ interests: 'Select at least one interest.' });
        showFlash({ type: 'warning', message: 'Please select at least one interest.' });
        return false;
      }
      await onboarding.saveInterests.mutateAsync({ interestIds: interests.map((item) => item.id) });
      setErrors({});
    } else if (step === 4 && historyDirty) {
      setErrors({ form: 'Save or cancel the open experience or education form before continuing.' });
      showFlash({ type: 'warning', message: 'Save or cancel the open form before continuing.' });
      return false;
    }
    return true;
  }

  async function move(target: OnboardingStep) {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setMessage('');
    try {
      if (target > step && !(await persistCurrent())) {
        heading.current?.focus();
        return;
      }
      const result = await onboarding.saveProgress.mutateAsync({ currentStep: target });
      setSnapshot(result.onboarding);
      onboarding.client.setQueryData(['onboarding', 'progress'], result);
      setStep(result.onboarding.currentStep);
      setErrors({});
    } catch (error) {
      setMessage(problem(error));
      showFlash({ type: 'error', message: problem(error) });
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  async function finish() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setMessage('');
    try {
      const result = await onboarding.complete.mutateAsync();
      if (result.onboarding.status !== 'COMPLETED') throw new Error('Onboarding was not confirmed.');
      onboarding.client.setQueryData(['onboarding', 'progress'], result);
      const current = await authApi.currentUser();
      if (!current || current.onboardingStatus !== 'COMPLETED')
        throw new Error('Your completed account could not be confirmed. Please try again.');
      onboarding.client.setQueryData(currentUserKey, current);
      await onboarding.client.invalidateQueries({ queryKey: ['onboarding'] });
      showFlash({ type: 'success', message: 'Your Voklance profile is ready.' });
      navigate('/app', { replace: true });
    } catch (error) {
      setMessage(problem(error));
      showFlash({ type: 'error', message: problem(error) });
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  const missing = [
    !onboardingIdentitySchema.safeParse({
      firstName: snapshot.profile?.firstName,
      lastName: snapshot.profile?.lastName,
      headline: snapshot.profile?.headline || ''
    }).success && 'Basic profile',
    !snapshot.profile?.professionalStatus && 'Professional status',
    !snapshot.skills.length && 'Skills',
    !snapshot.interests.length && 'Interests'
  ].filter((value): value is string => typeof value === 'string');
  const profileCompletion =
    [
      identity.firstName.trim().length > 0,
      identity.lastName.trim().length > 0 &&
        `${identity.firstName.trim()} ${identity.lastName.trim()}`.length <= 80
    ].filter(Boolean).length * 50;
  const completionByStep: Record<OnboardingStep, number> = {
    1: profileCompletion,
    2: statusSchema.safeParse(status).success ? 100 : 0,
    3: skills.length > 0 ? 100 : 0,
    4: history.experiences.length > 0 || history.education.length > 0 ? 100 : 0,
    5: interests.length > 0 ? 100 : 0,
    6: snapshot.status === 'COMPLETED' ? 100 : 0
  };

  function submit() {
    if (step === 6) void finish();
    else void move((step + 1) as OnboardingStep);
  }

  return (
    <div className="onboarding-container">
      <div className="onboarding-content">
        <h1 tabIndex={-1} ref={heading}>
          {stepNames[step - 1]}
        </h1>
        <p className="onboarding-intro">
          {
            [
              'Introduce your professional identity to the Voklance community.',
              'Tell us where you are in your professional journey.',
              'Choose the expertise you want people to discover.',
              'Add your background, or continue without it.',
              'Choose the topics and opportunities that matter to you.',
              'Review your saved details before completing setup.'
            ][step - 1]
          }
        </p>
        <p className="onboarding-count">Step {step} of 6</p>
        <OnboardingProgress
          step={step}
          completionByStep={completionByStep}
          completed={snapshot.completedSteps}
          onSelect={(target) => {
            if (target !== step) void move(target);
          }}
        />
        {message && (
          <p className="onboarding-alert" role="alert">
            {message}
          </p>
        )}
        {errors.form && (
          <p className="onboarding-alert" role="alert">
            {errors.form}
          </p>
        )}
        <div>
          <div hidden={step !== 1}>
            <ProfileStep
              value={identity}
              onChange={(next, field) => {
                setIdentity(next);
                setErrors((current) => {
                  if (!current[field]) return current;
                  const updated = { ...current };
                  delete updated[field];
                  return updated;
                });
              }}
              errors={errors}
            />
          </div>
          <div hidden={step !== 2}>
            <ProfessionalStatusStep value={status} onChange={setStatus} error={errors.status} />
          </div>
          <div hidden={step !== 3}>
            <CatalogSelector
              kind="skill"
              search={skillSearch}
              loadedSearch={debouncedSkillSearch}
              onSearch={setSkillSearch}
              selected={skills}
              onChange={setSkills}
              catalog={skillCatalog}
            />
            {errors.skills && (
              <p className="onboarding-error" role="alert">
                {errors.skills}
              </p>
            )}
          </div>
          <div hidden={step !== 4}>
            <HistoryStep
              experiences={history.experiences}
              education={history.education}
              onDirtyChange={historyChanged}
            />
          </div>
          <div hidden={step !== 5}>
            <CatalogSelector
              kind="interest"
              search={interestSearch}
              loadedSearch={debouncedInterestSearch}
              onSearch={setInterestSearch}
              selected={interests}
              onChange={setInterests}
              catalog={interestCatalog}
            />
            {errors.interests && (
              <p className="onboarding-error" role="alert">
                {errors.interests}
              </p>
            )}
          </div>
          <div hidden={step !== 6}>
            <Review snapshot={snapshot} missing={missing} onEdit={(target) => void move(target)} />
          </div>
          <div className="onboarding-actions">
            {step > 1 && (
              <button
                type="button"
                className="onboarding-back"
                disabled={saving}
                onClick={() => void move((step - 1) as OnboardingStep)}
              >
                Previous
              </button>
            )}
            <button
              type="button"
              onClick={submit}
              className="submit-button"
              disabled={saving || (step === 6 && missing.length > 0)}
            >
              {saving
                ? 'Saving…'
                : step === 6
                  ? snapshot.status === 'COMPLETED'
                    ? 'Go to Voklance'
                    : 'Complete onboarding'
                  : step === 4
                    ? 'Continue'
                    : 'Next'}
              {step < 6 && !saving && <span aria-hidden="true">→</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Review({
  snapshot,
  missing,
  onEdit
}: {
  snapshot: OnboardingSnapshot;
  missing: string[];
  onEdit: (step: OnboardingStep) => void;
}) {
  return (
    <div className="review-sections">
      {missing.length > 0 && (
        <div className="onboarding-alert" role="alert">
          Complete these sections first: {missing.join(', ')}.
        </div>
      )}
      <div className="review-panel">
        <ReviewSection title="Basic profile" description="Your personal information" step={1} onEdit={onEdit}>
          {snapshot.profile ? (
            <div className="review-profile-value">
              <strong>{snapshot.profile.fullName}</strong>
              {snapshot.profile.headline && <span>{snapshot.profile.headline}</span>}
            </div>
          ) : (
            <p className="review-empty">Not saved yet.</p>
          )}
        </ReviewSection>
        <ReviewSection
          title="Professional status"
          description="Your current work status"
          step={2}
          onEdit={onEdit}
        >
          <p>
            {snapshot.profile?.professionalStatus
              ? professionalStatusLabels[snapshot.profile.professionalStatus]
              : 'Not saved yet.'}
          </p>
        </ReviewSection>
        <ReviewSection title="Skills" description="Your key skills and expertise" step={3} onEdit={onEdit}>
          {snapshot.skills.length ? (
            <ul className="review-chips">
              {snapshot.skills.map((item) => (
                <li key={item.id}>{item.name}</li>
              ))}
            </ul>
          ) : (
            <p className="review-empty">No skills saved yet.</p>
          )}
        </ReviewSection>
        <ReviewSection
          title="Experience & education"
          description="Your work and educational background"
          step={4}
          onEdit={onEdit}
        >
          <div className="review-history-values">
            {snapshot.experiences.length ? (
              snapshot.experiences.map((item) => (
                <div className="review-history-value" key={item.id}>
                  <ReviewIcon step={2} />
                  <span>
                    {item.jobTitle} at {item.companyName}
                  </span>
                </div>
              ))
            ) : (
              <p className="review-empty">No experience added.</p>
            )}
            {snapshot.education.length ? (
              snapshot.education.map((item) => (
                <div className="review-history-value" key={item.id}>
                  <ReviewIcon step={4} />
                  <span>{item.institution}</span>
                </div>
              ))
            ) : (
              <p className="review-empty">No education added.</p>
            )}
          </div>
        </ReviewSection>
        <ReviewSection title="Interests" description="Topics you’re interested in" step={5} onEdit={onEdit}>
          {snapshot.interests.length ? (
            <ul className="review-chips">
              {snapshot.interests.map((item) => (
                <li key={item.id}>{item.name}</li>
              ))}
            </ul>
          ) : (
            <p className="review-empty">No interests saved yet.</p>
          )}
        </ReviewSection>
      </div>
    </div>
  );
}

function ReviewSection({
  title,
  description,
  step,
  onEdit,
  children
}: {
  title: string;
  description: string;
  step: OnboardingStep;
  onEdit: (step: OnboardingStep) => void;
  children: ReactNode;
}) {
  return (
    <section className="review-section">
      <span className="review-icon-tile">
        <ReviewIcon step={step} />
      </span>
      <div className="review-label">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <span className="review-divider" aria-hidden="true" />
      <div className="review-details">{children}</div>
      <button
        type="button"
        className="review-edit"
        aria-label={`Edit ${title.toLowerCase()}`}
        onClick={() => onEdit(step)}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="m4 20 4.1-.9L19 8.2 15.8 5 4.9 15.9 4 20Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="m13.8 7 3.2 3.2" stroke="currentColor" strokeWidth="1.8" />
        </svg>
        <span>Edit</span>
      </button>
    </section>
  );
}

function ReviewIcon({ step }: { step: OnboardingStep }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {step === 1 && (
        <>
          <circle cx="12" cy="7" r="3.5" />
          <path d="M4.5 21v-2.2a7.5 7.5 0 0 1 15 0V21" />
        </>
      )}
      {step === 2 && (
        <>
          <rect x="2.5" y="7" width="19" height="14" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M2.5 12h19M10 12v2h4v-2" />
        </>
      )}
      {step === 3 && <path d="m8 6-6 6 6 6M16 6l6 6-6 6M14 3l-4 18" />}
      {step === 4 && (
        <>
          <path d="m1.5 9 10.5-5 10.5 5L12 14 1.5 9ZM5 11v6l7 3 7-3v-6M22.5 9v8" />
        </>
      )}
      {step === 5 && (
        <>
          <path d="m12 2 9 5-9 5-9-5 9-5ZM3 11l9 5 9-5M3 15l9 5 9-5" />
        </>
      )}
    </svg>
  );
}
