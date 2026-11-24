import CreatePostCard from '../components/CreatePostCard';
import { useState } from 'react';
import type { FeedMode } from '@voklance/shared';
import RecommendedFeed from '@/features/recommendations/components/RecommendedFeed';

export default function HomePage() {
  const [mode, setMode] = useState<FeedMode>('recent');
  return (
    <div className="feed-page feed-page-home">
      <header className="feed-page-heading">
        <h1>Professional feed</h1>
        <p>Ideas, lessons, and updates from Voklance professionals.</p>
      </header>
      <div className="feed-stream">
        <CreatePostCard />
        <div className="feed-stream-toolbar">
          <label>
            Sort by:{' '}
            <select value={mode} onChange={(event) => setMode(event.target.value as FeedMode)}>
              <option value="recent">Newest</option>
              <option value="for-you">For You</option>
              <option value="following">Following</option>
            </select>
          </label>
        </div>
        <RecommendedFeed mode={mode} />
      </div>
    </div>
  );
}
