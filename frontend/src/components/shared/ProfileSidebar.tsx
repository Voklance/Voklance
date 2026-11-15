import type { AuthUser } from '@voklance/shared';
import { Link } from 'react-router';
import { useMyProfile } from '@/features/profiles/hooks/useProfileData';
import { useMyCommunities } from '@/features/communities/hooks/useCommunities';

export default function ProfileSidebar({ user }: { user: AuthUser }) {
  const profile = useMyProfile();
  const communities = useMyCommunities();
  const joined = communities.data?.pages.flatMap((page) => page.items).slice(0, 5) ?? [];
  return (
    <aside className="dashboard-aside" aria-label="Your account and communities">
      <section className="aside-section">
        <h2>Your profile</h2>
        <span className="profile-aside-avatar" aria-hidden="true">
          {(profile.data?.profile?.fullName ?? user.name).trim().charAt(0).toUpperCase()}
        </span>
        <strong>{profile.data?.profile?.fullName ?? user.name}</strong>
        {profile.data?.profile?.headline && <p>{profile.data.profile.headline}</p>}
        {profile.data?.profile?.username && <p>@{profile.data.profile.username}</p>}
        {profile.isPending && <p role="status">Loading profile…</p>}
        {profile.isError && <p>Profile details are temporarily unavailable.</p>}
        <Link className="profile-aside-link" to="/app/profile">
          View profile
        </Link>
      </section>
      <section className="aside-section">
        <h2>Your communities</h2>
        {communities.isPending ? (
          <p role="status">Loading communities…</p>
        ) : communities.isError ? (
          <p>Communities are temporarily unavailable.</p>
        ) : joined.length === 0 ? (
          <p>You have not joined a community yet.</p>
        ) : (
          <ul className="community-aside-list">
            {joined.map((community) => (
              <li key={community.id}>
                <Link to={`/app/communities/${community.slug}`}>{community.name}</Link>
              </li>
            ))}
          </ul>
        )}
        <Link className="profile-aside-link" to="/app/communities">
          Explore communities
        </Link>
      </section>
    </aside>
  );
}
