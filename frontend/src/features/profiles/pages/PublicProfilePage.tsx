import { Link, useParams } from 'react-router';
import { useState } from 'react';
import axios from 'axios';
import ErrorState from '@/components/shared/ErrorState';
import LoadingState from '@/components/shared/LoadingState';
import ProfileDetails from '../components/ProfileDetails';
import { usePublicProfile } from '../hooks/useProfileData';
import ConnectionButton from '@/features/connections/components/ConnectionButton';
import { useConnectionStatus, useVisibleConnections } from '@/features/connections/hooks/useNetwork';
import StartConversationButton from '@/features/messaging/components/StartConversationButton';
import { ProfileRatingForm } from '../components/ProfileRating';

export default function PublicProfilePage() {
  const { username = '' } = useParams();
  const query = usePublicProfile(username);
  const network = useConnectionStatus(username);
  const [showConnections, setShowConnections] = useState(false);
  const visible = useVisibleConnections(username, showConnections);
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
    <>
      <ProfileDetails
        profile={query.data.profile}
        rating={query.data.rating}
        skills={query.data.skills}
        experiences={query.data.experiences}
        education={query.data.education}
        certifications={query.data.certifications}
        projects={query.data.projects}
        actions={
          network.data && !network.data.isSelf ? (
            <>
              <ConnectionButton username={username} status={network.data.status} />
              {network.data.status === 'connected' && <StartConversationButton username={username} />}
            </>
          ) : undefined
        }
      />
      {network.data && !network.data.isSelf && <ProfileRatingForm username={username} />}
      {!network.data?.isSelf &&
        network.data?.connectionCount !== null &&
        network.data?.connectionCount !== undefined &&
        network.data.connectionCount > 0 && (
          <section className="network-profile-action">
            <button
              type="button"
              className="community-action"
              aria-expanded={showConnections}
              onClick={() => setShowConnections(!showConnections)}
            >
              {showConnections ? 'Hide connections' : 'View connections'}
            </button>
            {showConnections &&
              (visible.isPending ? (
                <p role="status">Loading connections…</p>
              ) : visible.isError ? (
                <p role="alert">Could not load connections.</p>
              ) : (
                <>
                  <ul>
                    {visible.data?.pages
                      .flatMap((page) => page.items)
                      .map((person) => (
                        <li key={person.userId}>
                          <Link to={`/app/professionals/${person.username}`}>{person.fullName}</Link> ·{' '}
                          {person.headline}
                        </li>
                      ))}
                  </ul>
                  {visible.hasNextPage && (
                    <button
                      type="button"
                      className="community-action"
                      disabled={visible.isFetchingNextPage}
                      onClick={() => void visible.fetchNextPage()}
                    >
                      Load more connections
                    </button>
                  )}
                </>
              ))}
          </section>
        )}
    </>
  );
}
