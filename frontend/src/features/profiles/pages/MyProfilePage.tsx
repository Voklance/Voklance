import { Link, useLocation } from 'react-router';
import ErrorState from '@/components/shared/ErrorState';
import LoadingState from '@/components/shared/LoadingState';
import ProfileDetails from '../components/ProfileDetails';
import {
  useMyEducations,
  useMyExperiences,
  useMyInterests,
  useMyProfile,
  useMySkills
} from '../hooks/useProfileData';
import { useNetworkCounts } from '@/features/connections/hooks/useNetwork';
import PortfolioManager from '../components/PortfolioManager';
import { useQuery } from '@tanstack/react-query';
import { portfolioApi } from '../api/portfolioApi';
import { useState } from 'react';
import ProfileSectionOrder from '../components/ProfileSectionOrder';

export default function MyProfilePage() {
  const location = useLocation();
  const profile = useMyProfile();
  const skills = useMySkills();
  const interests = useMyInterests();
  const experiences = useMyExperiences();
  const education = useMyEducations();
  const network = useNetworkCounts();
  const certifications = useQuery({ queryKey: ['my-certifications'], queryFn: portfolioApi.certifications });
  const projects = useQuery({ queryKey: ['my-projects'], queryFn: portfolioApi.projects });
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const queries = [profile, skills, interests, experiences, education];
  if (queries.some((query) => query.isPending)) return <LoadingState label="Loading your profile…" />;
  if (queries.some((query) => query.isError))
    return (
      <ErrorState
        message="Could not load your profile."
        onRetry={() => void Promise.all(queries.map((query) => query.refetch()))}
      />
    );
  if (!profile.data?.profile)
    return (
      <section className="profile-empty">
        <h1>Your profile</h1>
        <p>Your professional profile has not been created yet.</p>
        <Link className="profile-primary-action" to="/app/profile/edit">
          Create profile
        </Link>
      </section>
    );
  const shareUsername = profile.data.profile.username;
  return (
    <>
      {(location.state as { saved?: boolean } | null)?.saved && (
        <p className="profile-success" role="status">
          Profile saved.
        </p>
      )}
      <ProfileDetails
        owner
        profile={profile.data.profile}
        skills={skills.data?.skills ?? []}
        interests={interests.data?.interests ?? []}
        experiences={experiences.data?.experiences ?? []}
        education={education.data?.educations ?? []}
        certifications={certifications.data?.items ?? []}
        projects={projects.data?.items ?? []}
      />
      {profile.data.profile.visibility === 'PUBLIC' && (
        <div className="profile-share">
          <Link to={`/u/${shareUsername}`}>View as visitor</Link>
          <button
            type="button"
            onClick={() => {
              if (!navigator.clipboard?.writeText) {
                setCopyError(true);
                return;
              }
              void navigator.clipboard
                .writeText(`${window.location.origin}/u/${shareUsername}`)
                .then(() => {
                  setCopied(true);
                  setCopyError(false);
                })
                .catch(() => {
                  setCopied(false);
                  setCopyError(true);
                });
            }}
          >
            Copy profile link
          </button>
          {copied && <span role="status">Link copied.</span>}
          {copyError && <span role="alert">Copy unavailable. Use the visitor link instead.</span>}
        </div>
      )}
      <PortfolioManager />
      <ProfileSectionOrder initial={profile.data.profile.sectionOrder} />
      <p className="network-own-count">
        {network.data?.counts.connections ?? '—'} connections · <Link to="/app/network">Manage network</Link>
      </p>
      <p>
        <Link to="/app/github">Manage GitHub projects</Link>
      </p>
    </>
  );
}
