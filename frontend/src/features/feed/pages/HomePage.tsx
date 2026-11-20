import CreatePostCard from '../components/CreatePostCard';
import { useState } from 'react';
import { Link } from 'react-router';
import type { FeedMode } from '@voklance/shared';
import RecommendedFeed from '@/features/recommendations/components/RecommendedFeed';
import RecommendationSidebar from '@/features/recommendations/components/RecommendationSidebar';

export default function HomePage() {
  const [mode, setMode] = useState<FeedMode>('for-you');
  return (
    <div className="feed-page">
      <header className="feed-page-heading">
        <h1>Professional feed</h1>
        <p>Ideas, lessons, and updates from Voklance professionals.</p>
      </header>
      <CreatePostCard />
      <nav className="feed-mode-tabs" aria-label="Feed view">
        {(['for-you', 'following', 'recent'] as const).map((tab) => (
          <button
            type="button"
            key={tab}
            className={mode === tab ? 'active' : ''}
            aria-current={mode === tab ? 'page' : undefined}
            onClick={() => setMode(tab)}
          >
            {tab === 'for-you' ? 'For You' : tab === 'following' ? 'Following' : 'Recent'}
          </button>
        ))}
        <Link to="/app/settings/feed">Feed interests</Link>
      </nav>
      <div className="personalized-feed-layout">
        <RecommendedFeed mode={mode} />
        <RecommendationSidebar />
      </div>
    </div>
  );
}
