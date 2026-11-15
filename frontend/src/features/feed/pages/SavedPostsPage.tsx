import FeedList from '../components/FeedList';
export default function SavedPostsPage() {
  return (
    <div className="feed-page">
      <header className="feed-page-heading">
        <h1>Saved posts</h1>
        <p>Posts you want to return to.</p>
      </header>
      <FeedList saved />
    </div>
  );
}
