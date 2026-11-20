import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { apiErrorMessage } from '@/lib/apiClient';
import { clearAuthenticatedCache } from '@/features/auth/cache/authCache';
import { settingsApi } from '../api/settingsApi';
import { useSessions, useSettingsActions } from '../hooks/useSettings';
export default function SecuritySettingsPage() {
  const sessions = useSessions();
  const actions = useSettingsActions();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [sessionPassword, setSessionPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    if (next !== confirm) {
      setMessage('New passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await settingsApi.changePassword(current, next, confirm);
      setCurrent('');
      setNext('');
      setConfirm('');
      await clearAuthenticatedCache(client);
      navigate('/login', { replace: true });
    } catch (error) {
      setMessage(apiErrorMessage(error));
      setBusy(false);
    }
  }
  async function bulk(action: 'others' | 'all') {
    if (
      !sessionPassword ||
      !window.confirm(
        action === 'all' ? 'Log out every device, including this one?' : 'Log out every other device?'
      )
    )
      return;
    setMessage('');
    setBusy(true);
    try {
      if (action === 'others') {
        await settingsApi.logoutOthers(sessionPassword);
        await sessions.refetch();
        setMessage('Other sessions revoked.');
      } else {
        await settingsApi.logoutAll(sessionPassword);
        await clearAuthenticatedCache(client);
        navigate('/login', { replace: true });
      }
      setSessionPassword('');
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settings-page">
      <Link to="/app/settings">← Settings</Link>
      <h1>Security</h1>
      <section className="settings-panel">
        <h2>Change password</h2>
        <p>Use at least twelve characters. Changing your password signs out every device.</p>
        <form onSubmit={(event) => void changePassword(event)}>
          <label htmlFor="current-password">Current password</label>
          <input
            id="current-password"
            type={show ? 'text' : 'password'}
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            required
          />
          <label htmlFor="new-password">New password</label>
          <input
            id="new-password"
            type={show ? 'text' : 'password'}
            minLength={12}
            maxLength={128}
            value={next}
            onChange={(event) => setNext(event.target.value)}
            required
          />
          <label htmlFor="confirm-password">Confirm new password</label>
          <input
            id="confirm-password"
            type={show ? 'text' : 'password'}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            required
          />
          <label className="settings-checkbox">
            <input type="checkbox" checked={show} onChange={(event) => setShow(event.target.checked)} /> Show
            passwords
          </label>
          <button type="submit" disabled={busy}>
            Change password
          </button>
        </form>
      </section>
      <section className="settings-panel">
        <h2>Active sessions</h2>
        {sessions.isPending ? (
          <p role="status">Loading sessions…</p>
        ) : sessions.isError ? (
          <p role="alert">Sessions unavailable.</p>
        ) : (
          <ul className="session-list">
            {sessions.data.items.map((session) => (
              <li key={session.id}>
                <div>
                  <strong>{session.current ? 'Current session' : session.device}</strong>
                  <small>
                    Started {new Date(session.createdAt).toLocaleString()} · Last active{' '}
                    {session.lastSeenAt ? new Date(session.lastSeenAt).toLocaleString() : 'unknown'} · Expires{' '}
                    {new Date(session.expiresAt).toLocaleDateString()}
                  </small>
                </div>
                <button
                  type="button"
                  disabled={actions.revokeSession.isPending}
                  onClick={() => {
                    if (window.confirm('Log out this session?'))
                      void actions.revokeSession
                        .mutateAsync(session.id)
                        .then(async (result) => {
                          if (result.signedOut) {
                            await clearAuthenticatedCache(client);
                            navigate('/login', { replace: true });
                          }
                        })
                        .catch((error: unknown) => setMessage(apiErrorMessage(error)));
                  }}
                >
                  Log out
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="settings-bulk">
          <label htmlFor="session-password">Current password for bulk actions</label>
          <input
            id="session-password"
            type="password"
            value={sessionPassword}
            onChange={(event) => setSessionPassword(event.target.value)}
          />
          <div>
            <button type="button" disabled={busy || !sessionPassword} onClick={() => void bulk('others')}>
              Log out other devices
            </button>
            <button type="button" disabled={busy || !sessionPassword} onClick={() => void bulk('all')}>
              Log out all devices
            </button>
          </div>
        </div>
      </section>
      {message && (
        <p className="settings-message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
