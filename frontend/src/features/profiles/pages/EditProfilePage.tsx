import {
  PROFESSIONAL_STATUSES,
  PROFILE_VISIBILITIES,
  type CatalogItem,
  type ProfilePatchRequest
} from '@voklance/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod';
import ErrorState from '@/components/shared/ErrorState';
import LoadingState from '@/components/shared/LoadingState';
import CatalogSelector from '@/features/onboarding/components/CatalogSelector';
import HistoryStep from '@/features/onboarding/components/HistoryStep';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { onboardingKeys, useSkillsCatalog } from '@/features/onboarding/hooks/useOnboarding';
import { fieldErrors, profileSchema } from '@/features/onboarding/validation/onboardingSchemas';
import { apiErrorMessage } from '@/lib/apiClient';
import { profileApi } from '../api/profileApi';
import { useMyEducations, useMyExperiences, useMyProfile, useMySkills } from '../hooks/useProfileData';

const urlInput = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password;
    } catch {
      return false;
    }
  }, 'Enter a secure HTTPS URL.');
const editSchema = profileSchema.extend({
  professionalStatus: z.union([z.literal(''), z.enum(PROFESSIONAL_STATUSES)]),
  githubUrl: urlInput.refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return ['github.com', 'www.github.com'].includes(url.hostname) && url.pathname !== '/';
    } catch {
      return false;
    }
  }, 'Enter a GitHub profile URL.'),
  portfolioUrl: urlInput,
  websiteUrl: urlInput,
  visibility: z.enum(PROFILE_VISIBILITIES)
});
type Draft = z.infer<typeof editSchema>;

export default function EditProfilePage() {
  const profile = useMyProfile();
  const skills = useMySkills();
  const experiences = useMyExperiences();
  const education = useMyEducations();
  const account = useCurrentUser();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CatalogItem[] | null>(null);
  const [skillMessage, setSkillMessage] = useState('');
  const catalog = useSkillsCatalog(search, true);
  const save = useMutation({ mutationFn: profileApi.save });
  const saveSkills = useMutation({ mutationFn: profileApi.saveSkills });

  useEffect(() => {
    if (profile.data && draft === null) {
      const value = profile.data.profile;
      setDraft({
        fullName: value?.fullName ?? account.data?.name ?? '',
        username: value?.username ?? '',
        headline: value?.headline ?? '',
        bio: value?.bio ?? '',
        city: value?.city ?? '',
        country: value?.country ?? '',
        professionalStatus: value?.professionalStatus ?? '',
        githubUrl: value?.githubUrl ?? '',
        portfolioUrl: value?.portfolioUrl ?? '',
        websiteUrl: value?.websiteUrl ?? '',
        visibility: value?.visibility ?? 'PRIVATE'
      });
    }
  }, [profile.data, account.data?.name, draft]);
  useEffect(() => {
    if (skills.data && selected === null) setSelected(skills.data.skills);
  }, [skills.data, selected]);

  const queries = [profile, skills, experiences, education];
  if (queries.some((query) => query.isError))
    return (
      <ErrorState
        message="Could not load profile details."
        onRetry={() => void Promise.all(queries.map((query) => query.refetch()))}
      />
    );
  if (queries.some((query) => query.isPending) || !draft || selected === null)
    return <LoadingState label="Loading profile editor…" />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const parsed = editSchema.safeParse(draft);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setMessage('');
    const input: ProfilePatchRequest = {
      fullName: parsed.data.fullName,
      username: parsed.data.username,
      headline: parsed.data.headline,
      country: parsed.data.country,
      city: parsed.data.city,
      bio: parsed.data.bio,
      professionalStatus: parsed.data.professionalStatus || undefined,
      githubUrl: parsed.data.githubUrl || null,
      portfolioUrl: parsed.data.portfolioUrl || null,
      websiteUrl: parsed.data.websiteUrl || null,
      visibility: parsed.data.visibility
    };
    try {
      await save.mutateAsync(input);
      await Promise.all([
        client.invalidateQueries({ queryKey: onboardingKeys.profile }),
        client.invalidateQueries({ queryKey: onboardingKeys.progress }),
        client.invalidateQueries({ queryKey: ['profiles', 'public'] })
      ]);
      navigate('/app/profile', { replace: true, state: { saved: true } });
    } catch (error) {
      const code = (error as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error
        ?.code;
      if (code === 'USERNAME_TAKEN') setErrors({ username: 'This username is already in use.' });
      setMessage(apiErrorMessage(error));
    }
  }

  async function submitSkills() {
    if (!selected) return;
    setSkillMessage('');
    try {
      await saveSkills.mutateAsync({ skillIds: selected.map((item) => item.id) });
      await Promise.all([
        client.invalidateQueries({ queryKey: onboardingKeys.selectedSkills }),
        client.invalidateQueries({ queryKey: onboardingKeys.progress }),
        client.invalidateQueries({ queryKey: ['profiles', 'public'] })
      ]);
      setSkillMessage('Skills saved.');
    } catch (error) {
      setSkillMessage(apiErrorMessage(error));
    }
  }

  const update = (field: keyof Draft, value: string) => {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
    setErrors((current) => ({ ...current, [field]: '' }));
  };
  const field = (name: keyof Draft, label: string, options?: { required?: boolean; multiline?: boolean }) => (
    <div className="onboarding-field" key={name}>
      <label htmlFor={`profile-${name}`}>
        {label}
        {options?.required && <span>Required</span>}
      </label>
      {options?.multiline ? (
        <textarea
          id={`profile-${name}`}
          value={draft[name]}
          maxLength={500}
          onChange={(event) => update(name, event.target.value)}
          aria-invalid={!!errors[name]}
          aria-describedby={`profile-${name}-error`}
          rows={5}
        />
      ) : (
        <input
          id={`profile-${name}`}
          value={draft[name]}
          onChange={(event) => update(name, event.target.value)}
          aria-invalid={!!errors[name]}
          aria-describedby={`profile-${name}-error`}
          required={options?.required}
        />
      )}
      {errors[name] && (
        <p className="onboarding-error" id={`profile-${name}-error`}>
          {errors[name]}
        </p>
      )}
    </div>
  );

  return (
    <div className="profile-editor">
      <div className="profile-editor-heading">
        <div>
          <p className="profile-username">Your professional identity</p>
          <h1>Edit profile</h1>
        </div>
        <Link to="/app/profile">Back to profile</Link>
      </div>
      <form onSubmit={(event) => void submit(event)} noValidate className="profile-edit-form">
        <section className="profile-edit-section" aria-labelledby="edit-basics">
          <h2 id="edit-basics">Basic information</h2>
          <div className="profile-form-grid">
            {field('fullName', 'Full name', { required: true })}
            {field('username', 'Username', { required: true })}
            {field('headline', 'Professional headline', { required: true })}
            {field('city', 'City')}
            {field('country', 'Country', { required: true })}
            <div className="onboarding-field">
              <label htmlFor="profile-status">Professional status</label>
              <select
                id="profile-status"
                value={draft.professionalStatus}
                onChange={(event) => update('professionalStatus', event.target.value)}
              >
                <option value="">Choose a status</option>
                {PROFESSIONAL_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll('_', ' ').toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="profile-wide">{field('bio', 'About you', { multiline: true })}</div>
          </div>
        </section>
        <section className="profile-edit-section" aria-labelledby="edit-links">
          <h2 id="edit-links">Professional links</h2>
          <div className="profile-form-grid">
            {field('githubUrl', 'GitHub profile URL')}
            {field('portfolioUrl', 'Portfolio URL')}
            {field('websiteUrl', 'Website URL')}
          </div>
        </section>
        <section className="profile-edit-section" aria-labelledby="edit-visibility">
          <h2 id="edit-visibility">Visibility</h2>
          <p>
            Public profiles show your name, bio, skills, experience, education, and links to other
            professionals. Private profiles stay visible only to you.
          </p>
          <label htmlFor="profile-visibility">Profile visibility</label>
          <select
            id="profile-visibility"
            value={draft.visibility}
            onChange={(event) => update('visibility', event.target.value)}
          >
            <option value="PRIVATE">Private</option>
            <option value="PUBLIC">Public</option>
          </select>
        </section>
        <section className="profile-edit-section" aria-labelledby="edit-photo">
          <h2 id="edit-photo">Profile image</h2>
          <p>
            Image upload is unavailable until secure storage is configured. Your initials appear in the
            meantime.
          </p>
        </section>
        {message && (
          <p className="onboarding-alert" role="alert">
            {message}
          </p>
        )}
        <button className="profile-primary-action" type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save profile'}
        </button>
      </form>
      <section className="profile-edit-section" aria-labelledby="edit-skills">
        <h2 id="edit-skills">Skills</h2>
        <CatalogSelector
          kind="skill"
          search={search}
          onSearch={setSearch}
          selected={selected}
          onChange={setSelected}
          catalog={catalog}
        />
        {skillMessage && <p role="status">{skillMessage}</p>}
        <button
          className="profile-secondary-action"
          type="button"
          disabled={saveSkills.isPending || selected.length === 0}
          onClick={() => void submitSkills()}
        >
          {saveSkills.isPending ? 'Saving…' : 'Save skills'}
        </button>
      </section>
      <section className="profile-edit-section" aria-labelledby="edit-history">
        <h2 id="edit-history">Experience and education</h2>
        <HistoryStep
          experiences={experiences.data?.experiences ?? []}
          education={education.data?.educations ?? []}
          onDirtyChange={() => {}}
          confirmDeletion
        />
      </section>
    </div>
  );
}
