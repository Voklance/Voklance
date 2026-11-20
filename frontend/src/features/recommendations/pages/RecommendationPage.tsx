import { RECOMMENDATION_CATEGORIES, type RecommendationCategory } from '@voklance/shared';
import { Link, useParams } from 'react-router';
import { useRecommendationActions, useRecommendationCategory } from '../hooks/useRecommendations';
const labels: Record<RecommendationCategory, string> = {
  people: 'People you may know',
  communities: 'Suggested communities',
  events: 'Upcoming events',
  resources: 'Recommended resources',
  referrals: 'Referral opportunities'
};
export default function RecommendationPage() {
  const { category: value = '' } = useParams();
  const category = RECOMMENDATION_CATEGORIES.find((item) => item === value);
  if (!category) return <p>Recommendation category unavailable.</p>;
  return <CategoryPage category={category} />;
}
function CategoryPage({ category }: { category: RecommendationCategory }) {
  const query = useRecommendationCategory(category);
  const actions = useRecommendationActions();
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <div className="recommendation-page">
      <Link to="/app">← Home</Link>
      <h1>{labels[category]}</h1>
      {query.isPending ? (
        <p role="status">Loading recommendations…</p>
      ) : query.isError ? (
        <div role="alert">
          <p>Recommendations unavailable.</p>
          <button type="button" onClick={() => void query.refetch()}>
            Try again
          </button>
        </div>
      ) : items.length ? (
        <>
          <div className="recommendation-grid">
            {items.map((item) => (
              <article key={item.id}>
                <h2>
                  <Link to={item.href}>{item.title}</Link>
                </h2>
                <p>{item.description}</p>
                <small>{item.reason}</small>
                <button
                  type="button"
                  onClick={() =>
                    void actions.feedback.mutateAsync([category, item.id.split(':')[1], 'dismissed'])
                  }
                >
                  Dismiss
                </button>
              </article>
            ))}
          </div>
          {query.hasNextPage && (
            <button
              type="button"
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              Load more
            </button>
          )}
        </>
      ) : (
        <p>No suggestions right now. Check again after updating your interests or connections.</p>
      )}
    </div>
  );
}
