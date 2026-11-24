import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import CommunityActivityBoard from '@/features/community-commands/components/CommunityActivityBoard';
import { useCommunity } from '../hooks/useCommunities';

export default function CommunityChatWidget({ slug, onClose }: { slug: string; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const community = useCommunity(slug);

  useEffect(() => {
    closeButton.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <section id="community-chat-widget" className="community-chat-widget" aria-label="Community chat window">
      <header className="community-chat-widget-bar">
        <strong>Community chat</strong>
        <div>
          <Link
            to={`/app/communities/${slug}/chat`}
            aria-label="Open full community chat"
            title="Open full chat"
          >
            ↗
          </Link>
          <button ref={closeButton} type="button" onClick={onClose} aria-label="Close community chat">
            ×
          </button>
        </div>
      </header>
      {community.isPending ? (
        <p className="community-chat-widget-state" role="status">
          Loading community chat…
        </p>
      ) : community.isError ? (
        <div className="community-chat-widget-state" role="alert">
          <p>Community chat could not be loaded.</p>
          <button type="button" onClick={() => void community.refetch()}>
            Try again
          </button>
        </div>
      ) : community.data.community.visibility === 'PRIVATE' &&
        community.data.community.membershipStatus !== 'ACTIVE' ? (
        <div className="community-chat-widget-state">
          <p>Join this community to view its conversation.</p>
          <Link to={`/app/communities/${slug}`}>View community</Link>
        </div>
      ) : (
        <CommunityActivityBoard community={community.data.community} />
      )}
    </section>
  );
}
