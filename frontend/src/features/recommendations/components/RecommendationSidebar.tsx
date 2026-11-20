import type { RecommendationCategory } from '@voklance/shared';
import { Link } from 'react-router';
import { useRecommendationActions, useRecommendationCategory } from '../hooks/useRecommendations';
const labels: Record<RecommendationCategory, string> = {
  people: 'People you may know',
  communities: 'Suggested communities',
  events: 'Upcoming events',
  resources: 'Recommended resources',
  referrals: 'Referral opportunities'
};
function Preview({ category }: { category: RecommendationCategory }) {
  const query = useRecommendationCategory(category, 3);
  const actions = useRecommendationActions();
  const items = query.data?.pages[0]?.items ?? [];
  return (
    <section className="recommendation-preview">
      <div>
        <h3>{labels[category]}</h3>
        <Link to={`/app/recommendations/${category}`}>View all</Link>
      </div>
      {query.isPending ? (
        <p>Loading…</p>
      ) : query.isError ? (
        <p>Unavailable right now.</p>
      ) : items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <Link to={item.href}>{item.title}</Link>
              <small>{item.reason}</small>
              <button
                type="button"
                aria-label={`Dismiss ${item.title}`}
                onClick={() =>
                  void actions.feedback.mutateAsync([category, item.id.split(':')[1], 'dismissed'])
                }
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>No suggestions yet.</p>
      )}
    </section>
  );
}
export default function RecommendationSidebar() {
  return (
    <aside className="recommendation-sidebar" aria-label="Recommended for you">
      {(['people', 'communities', 'events', 'resources', 'referrals'] as const).map((category) => (
        <Preview key={category} category={category} />
      ))}
    </aside>
  );
}
