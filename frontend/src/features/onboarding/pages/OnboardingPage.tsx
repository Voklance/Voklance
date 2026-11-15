import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import axios from 'axios';
import type {
  AuthUser,
  CatalogItem,
  OnboardingSnapshot,
  OnboardingStep,
  ProfessionalStatus
} from '@voklance/shared';
import ErrorState from '@/components/shared/ErrorState';
import LoadingState from '@/components/shared/LoadingState';
import { currentUserKey } from '@/features/auth/hooks/useCurrentUser';
import { authApi } from '@/features/auth/api/authApi';
import { apiErrorMessage } from '@/lib/apiClient';
import { onboardingApi } from '../api/onboardingApi';
import CatalogSelector from '../components/CatalogSelector';
import HistoryStep from '../components/HistoryStep';
import OnboardingLayout from '../components/OnboardingLayout';
import OnboardingProgress, { stepNames } from '../components/OnboardingProgress';
import ProfileStep from '../components/ProfileStep';
import ProfessionalStatusStep, { professionalStatusLabels } from '../components/ProfessionalStatusStep';
import { useInterestsCatalog, useOnboarding, useSkillsCatalog } from '../hooks/useOnboarding';
import { fieldErrors, profileSchema, statusSchema, type ProfileDraft } from '../validation/onboardingSchemas';

const blankProfile: ProfileDraft = {
  fullName: '',
  username: '',
  headline: '',
  country: '',
  city: '',
  bio: ''
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
  const [snapshot, setSnapshot] = useState(initial);
  const [step, setStep] = useState<OnboardingStep>(initial.currentStep);
  const [profile, setProfile] = useState<ProfileDraft>(() => ({
    ...blankProfile,
    fullName: onboarding.client.getQueryData<AuthUser | null>(currentUserKey)?.name || '',
    ...initial.profile
  }));
  const [status, setStatus] = useState<ProfessionalStatus | ''>(initial.profile?.professionalStatus || '');
  const [skills, setSkills] = useState<CatalogItem[]>(initial.skills);
  const [interests, setInterests] = useState<CatalogItem[]>(initial.interests);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [skillSearch, setSkillSearch] = useState('');
  const [interestSearch, setInterestSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [historyDirty, setHistoryDirty] = useState(false);
  const busy = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const skillCatalog = useSkillsCatalog(useDebounced(skillSearch), step === 3);
  const interestCatalog = useInterestsCatalog(useDebounced(interestSearch), step === 5);
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
  const availability = useCallback((value: boolean | null) => setUsernameAvailable(value), []);
  const historyChanged = useCallback((value: boolean) => setHistoryDirty(value), []);

  async function persistCurrent() {
    if (step === 1) {
      const parsed = profileSchema.safeParse(profile);
      if (!parsed.success) {
        setErrors(fieldErrors(parsed.error));
        return false;
      }
      if (usernameAvailable === false) {
        setErrors({ username: 'Username is already in use.' });
        return false;
      }
      // The check immediately before save also covers a pending debounce and competing registrations.
      const result = await onboardingApi.username(parsed.data.username);
      if (!result.available) {
        setErrors({ username: 'Username is already in use.' });
        return false;
      }
      await onboarding.saveProfile.mutateAsync(parsed.data);
      setProfile(parsed.data);
      setErrors({});
    } else if (step === 2) {
      const parsed = statusSchema.safeParse(status);
      if (!parsed.success) {
        setErrors({ status: 'Choose a professional status.' });
        return false;
      }
      await onboarding.saveProfile.mutateAsync({ professionalStatus: parsed.data });
      setErrors({});
    } else if (step === 3) {
      if (!skills.length) {
        setErrors({ skills: 'Select at least one skill.' });
        return false;
      }
      await onboarding.saveSkills.mutateAsync({ skillIds: skills.map((item) => item.id) });
      setErrors({});
    } else if (step === 5) {
      if (!interests.length) {
        setErrors({ interests: 'Select at least one interest.' });
        return false;
      }
      await onboarding.saveInterests.mutateAsync({ interestIds: interests.map((item) => item.id) });
      setErrors({});
    } else if (step === 4 && historyDirty) {
      setErrors({ form: 'Save or cancel the open experience or education form before continuing.' });
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
      if (axios.isAxiosError(error) && error.response?.data?.error?.code === 'USERNAME_TAKEN')
        setErrors({ username: 'Username is already in use.' });
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
      navigate('/app', { replace: true });
    } catch (error) {
      setMessage(problem(error));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  const missing = [
    !profileSchema.safeParse({ ...blankProfile, ...snapshot.profile }).success && 'Basic profile',
    !snapshot.profile?.professionalStatus && 'Professional status',
    !snapshot.skills.length && 'Skills',
    !snapshot.interests.length && 'Interests'
  ].filter((value): value is string => typeof value === 'string');

  function submit() {
    if (step === 6) void finish();
    else void move((step + 1) as OnboardingStep);
  }

  return (
    <div className="onboarding-container">
      <OnboardingProgress
        step={step}
        completed={snapshot.completedSteps}
        onSelect={(target) => {
          if (target !== step) void move(target);
        }}
      />
      <div className="onboarding-content">
        <p className="onboarding-count">Step {step} of 6</p>
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
              value={profile}
              onChange={setProfile}
              errors={errors}
              onAvailability={availability}
            />
          </div>
          <div hidden={step !== 2}>
            <ProfessionalStatusStep value={status} onChange={setStatus} error={errors.status} />
          </div>
          <div hidden={step !== 3}>
            <CatalogSelector
              kind="skill"
              search={skillSearch}
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
            <button
              type="button"
              className="onboarding-back"
              disabled={step === 1 || saving}
              onClick={() => void move((step - 1) as OnboardingStep)}
            >
              Previous
            </button>
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
                    : 'Save and continue'}
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
      <ReviewSection title="Basic profile" step={1} onEdit={onEdit}>
        {snapshot.profile ? (
          <>
            <strong>{snapshot.profile.fullName}</strong>
            <span>@{snapshot.profile.username}</span>
            <span>{snapshot.profile.headline}</span>
            <span>{[snapshot.profile.city, snapshot.profile.country].filter(Boolean).join(', ')}</span>
            {snapshot.profile.bio && <p>{snapshot.profile.bio}</p>}
          </>
        ) : (
          <p>Not saved yet.</p>
        )}
      </ReviewSection>
      <ReviewSection title="Professional status" step={2} onEdit={onEdit}>
        <p>
          {snapshot.profile?.professionalStatus
            ? professionalStatusLabels[snapshot.profile.professionalStatus]
            : 'Not saved yet.'}
        </p>
      </ReviewSection>
      <ReviewSection title="Skills" step={3} onEdit={onEdit}>
        <p>{snapshot.skills.map((item) => item.name).join(', ') || 'No skills saved yet.'}</p>
      </ReviewSection>
      <ReviewSection title="Experience & education" step={4} onEdit={onEdit}>
        <p>
          {snapshot.experiences.map((item) => `${item.jobTitle} at ${item.companyName}`).join(', ') ||
            'No experience added.'}
        </p>
        <p>{snapshot.education.map((item) => item.institution).join(', ') || 'No education added.'}</p>
      </ReviewSection>
      <ReviewSection title="Interests" step={5} onEdit={onEdit}>
        <p>{snapshot.interests.map((item) => item.name).join(', ') || 'No interests saved yet.'}</p>
      </ReviewSection>
    </div>
  );
}

function ReviewSection({
  title,
  step,
  onEdit,
  children
}: {
  title: string;
  step: OnboardingStep;
  onEdit: (step: OnboardingStep) => void;
  children: ReactNode;
}) {
  return (
    <section className="review-section">
      <div>
        <h2>{title}</h2>
        <button type="button" onClick={() => onEdit(step)}>
          Edit {title.toLowerCase()}
        </button>
      </div>
      <div className="review-details">{children}</div>
    </section>
  );
}
