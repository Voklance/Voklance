import { useState } from 'react';
import { Link } from 'react-router';
import { apiErrorMessage } from '@/lib/apiClient';
import { useBlockedUsers, useSettingsActions } from '../hooks/useSettings';
export default function BlockedUsersPage() {
  const query = useBlockedUsers();
  const actions = useSettingsActions();
  const [message, setMessage] = useState('');
  return (
    <div className="settings-page">
      <Link to="/app/settings">← Settings</Link>
      <h1>Blocked users</h1>
      <p>Blocking prevents connections and direct messages. You can unblock a member here.</p>
      {query.isPending ? (
        <p role="status">Loading blocked users…</p>
      ) : query.isError ? (
        <p role="alert">Blocked users unavailable.</p>
      ) : query.data.items.length ? (
        <ul className="session-list">
          {query.data.items.map((person) => (
            <li key={person.userId}>
              <span>
                {person.name}
                {person.username ? ` (@${person.username})` : ''}
              </span>
              <button
                type="button"
                disabled={actions.unblock.isPending}
                onClick={() => {
                  if (window.confirm(`Unblock ${person.name}?`))
                    void actions.unblock
                      .mutateAsync(person.userId)
                      .then(() => setMessage('Member unblocked.'))
                      .catch((error: unknown) => setMessage(apiErrorMessage(error)));
                }}
              >
                Unblock
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>You have not blocked anyone.</p>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
