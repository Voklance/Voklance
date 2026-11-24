import { Link, useParams } from 'react-router';
import CommunityActivityBoard from '@/features/community-commands/components/CommunityActivityBoard';
import { useCommunity } from '../hooks/useCommunities';

export default function CommunityChatPage() {
  const { slug = '' } = useParams();
  const query = useCommunity(slug);

  if (query.isPending) return <p role="status">Loading community chat…</p>;
  if (query.isError)
    return (
      <div className="community-state" role="alert">
        <p>Community chat could not be loaded.</p>
        <button type="button" className="community-action" onClick={() => void query.refetch()}>
          Try again
        </button>
      </div>
    );

  const community = query.data.community;
  if (community.visibility === 'PRIVATE' && community.membershipStatus !== 'ACTIVE')
    return (
      <section className="community-chat-gate">
        <h1>{community.name}</h1>
        <p>Join this community to view its conversation.</p>
        <Link to={`/app/communities/${slug}`}>View community</Link>
      </section>
    );

  return (
    <div className="community-chat-page">
      <Link className="community-chat-back" to={`/app/communities/${slug}`}>
        ← Community overview
      </Link>
      <CommunityActivityBoard community={community} />
    </div>
  );
}
