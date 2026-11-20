import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import ErrorState from '@/components/shared/ErrorState';
import LoadingState from '@/components/shared/LoadingState';
import PostCard from '../components/PostCard';
import { feedApi } from '../api/feedApi';

export default function PostDetailPage() {
  const { postId = '' } = useParams();
  const query = useQuery({
    queryKey: ['posts', postId],
    queryFn: () => feedApi.post(postId),
    enabled: !!postId
  });
  return (
    <div className="feed-page">
      <header className="feed-page-heading">
        <Link to="/app">← Feed</Link>
        <h1>Professional post</h1>
      </header>
      {query.isPending ? (
        <LoadingState label="Loading post…" />
      ) : query.isError ? (
        <ErrorState message="This post is unavailable." onRetry={() => void query.refetch()} />
      ) : (
        <PostCard post={query.data.post} />
      )}
    </div>
  );
}
