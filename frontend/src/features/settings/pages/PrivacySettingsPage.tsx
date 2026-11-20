import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { apiErrorMessage } from '@/lib/apiClient';
import { usePrivacySettings, useSettingsActions } from '../hooks/useSettings';
import type { PrivacySettings } from '../api/settingsApi';
export default function PrivacySettingsPage() {
  const query = usePrivacySettings();
  const actions = useSettingsActions();
  const [draft, setDraft] = useState<PrivacySettings | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (query.data) setDraft(query.data.settings);
  }, [query.data]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setMessage('');
    try {
      await actions.updatePrivacy.mutateAsync(draft);
      setMessage('Privacy settings saved.');
    } catch (error) {
      setMessage(apiErrorMessage(error));
    }
  }
  const toggle = (key: keyof PrivacySettings, value: boolean) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  return (
    <div className="settings-page">
      <Link to="/app/settings">← Settings</Link>
      <h1>Privacy</h1>
      {query.isPending ? (
        <p role="status">Loading privacy settings…</p>
      ) : query.isError || !draft ? (
        <p role="alert">Privacy settings unavailable.</p>
      ) : (
        <form className="settings-panel" onSubmit={(event) => void save(event)}>
          <label>
            Profile visibility{' '}
            <select
              value={draft.visibility}
              onChange={(event) =>
                setDraft({ ...draft, visibility: event.target.value as PrivacySettings['visibility'] })
              }
            >
              <option value="PRIVATE">Private</option>
              <option value="PUBLIC">Public</option>
            </select>
          </label>
          <p>Only public profiles can appear in professional search and portfolios.</p>
          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={draft.profileDiscoverable}
              onChange={(event) => toggle('profileDiscoverable', event.target.checked)}
            />{' '}
            Show me in professional discovery
          </label>
          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={draft.allowConnectionRequests}
              onChange={(event) => toggle('allowConnectionRequests', event.target.checked)}
            />{' '}
            Allow connection requests
          </label>
          <label>
            Connection list visibility{' '}
            <select
              value={draft.connectionListVisibility}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  connectionListVisibility: event.target.value as PrivacySettings['connectionListVisibility']
                })
              }
            >
              <option value="private">Only me</option>
              <option value="connections">My connections</option>
            </select>
          </label>
          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={draft.allowDirectMessages}
              onChange={(event) => toggle('allowDirectMessages', event.target.checked)}
            />{' '}
            Allow direct messages from connections
          </label>
          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={draft.showReadReceipts}
              onChange={(event) => toggle('showReadReceipts', event.target.checked)}
            />{' '}
            Share read receipts
          </label>
          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={draft.showOnlineStatus}
              onChange={(event) => toggle('showOnlineStatus', event.target.checked)}
            />{' '}
            Share online status with connections
          </label>
          <button type="submit" disabled={actions.updatePrivacy.isPending}>
            Save privacy choices
          </button>
        </form>
      )}
      {message && (
        <p className="settings-message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
