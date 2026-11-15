import { useParams } from 'react-router';
import axios from 'axios';
import ErrorState from '@/components/shared/ErrorState';
import LoadingState from '@/components/shared/LoadingState';
import ProfileDetails from '../components/ProfileDetails';
import { usePublicProfile } from '../hooks/useProfileData';

export default function PublicProfilePage() {
  const { username = '' } = useParams();
  const query = usePublicProfile(username);
  if (query.isPending) return <LoadingState label="Loading professional profile…" />;
  if (query.isError)
    return (
      <ErrorState
        message={
          axios.isAxiosError(query.error) && query.error.response?.status === 404
            ? 'This professional profile is unavailable.'
            : 'Could not load this professional profile.'
        }
        onRetry={() => void query.refetch()}
      />
    );
  if (!query.data) return null;
  return (
    <ProfileDetails
      profile={query.data.profile}
      skills={query.data.skills}
      experiences={query.data.experiences}
      education={query.data.education}
    />
  );
}
