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

export default function MyProfilePage() {
  const location = useLocation();
  const profile = useMyProfile();
  const skills = useMySkills();
  const interests = useMyInterests();
  const experiences = useMyExperiences();
  const education = useMyEducations();
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
      />
    </>
  );
}
