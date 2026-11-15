import CreatePostCard from '../components/CreatePostCard';
import FeedList from '../components/FeedList';

export default function HomePage() {
  return (
    <div className="feed-page">
      <header className="feed-page-heading">
        <h1>Professional feed</h1>
        <p>Ideas, lessons, and updates from Voklance professionals.</p>
      </header>
      <CreatePostCard />
      <FeedList />
    </div>
  );
}
