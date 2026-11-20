import { useParams } from 'react-router';
import ProfileDetails from '../components/ProfileDetails';
import { usePublicProfile } from '../hooks/useProfileData';
import LoadingState from '@/components/shared/LoadingState';
import ErrorState from '@/components/shared/ErrorState';
export default function VisitorProfilePage() {
  const { username = '' } = useParams();
  const query = usePublicProfile(username);
  if (query.isPending) return <LoadingState label="Loading profile…" />;
  if (query.isError)
    return <ErrorState message="This profile is unavailable." onRetry={() => void query.refetch()} />;
  return (
    <main className="visitor-profile">
      <ProfileDetails
        profile={query.data.profile}
        skills={query.data.skills}
        experiences={query.data.experiences}
        education={query.data.education}
        certifications={query.data.certifications}
        projects={query.data.projects}
      />
    </main>
  );
}
