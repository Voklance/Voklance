import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { apiErrorMessage } from '@/lib/apiClient';
import { useFeedPreferences, useRecommendationActions } from '../hooks/useRecommendations';
export default function FeedPreferencesPage() {
  const query = useFeedPreferences();
  const actions = useRecommendationActions();
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (query.data) setDraft(query.data.preferences.topics.join(', '));
  }, [query.data]);
  async function save(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    try {
      await actions.savePreferences.mutateAsync(
        draft
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean)
      );
      setMessage('Feed interests saved.');
    } catch (failure) {
      setMessage(apiErrorMessage(failure));
    }
  }
  return (
    <div className="recommendation-page">
      <Link to="/app">← Home</Link>
      <h1>Feed interests</h1>
      <p>
        Your onboarding interests and skills also help suggest professional content. Add up to twelve topics
        here to guide your feed. You can remove them any time.
      </p>
      {query.isPending ? (
        <p role="status">Loading preferences…</p>
      ) : query.isError ? (
        <p role="alert">Preferences unavailable.</p>
      ) : (
        <form onSubmit={(event) => void save(event)}>
          <label htmlFor="feed-topics">Preferred topics, separated by commas</label>
          <textarea
            id="feed-topics"
            rows={4}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="React, TypeScript, accessibility"
          />
          <button type="submit" disabled={actions.savePreferences.isPending}>
            Save interests
          </button>
          {message && <p role="status">{message}</p>}
        </form>
      )}
    </div>
  );
}
