import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '@/lib/apiClient';
import { useFlash } from '@/components/shared/FlashMessages';
import { clearAuthenticatedCache } from '@/features/auth/cache/authCache';
import { settingsApi } from '../api/settingsApi';
import { useAccountInfo, useSettingsActions } from '../hooks/useSettings';
export default function AccountSettingsPage() {
  const query = useAccountInfo();
  const actions = useSettingsActions();
  const client = useQueryClient();
  const navigate = useNavigate();
  const { showFlash } = useFlash();
  const [name, setName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [deactivatePassword, setDeactivatePassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (query.data) setName(query.data.name);
  }, [query.data]);
  async function saveName(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    try {
      await actions.updateAccount.mutateAsync(name.trim());
      setMessage('Name updated.');
      showFlash({ type: 'success', message: 'Your display name has been updated.' });
    } catch (error) {
      setMessage(apiErrorMessage(error));
      showFlash({ type: 'error', message: apiErrorMessage(error) });
    }
  }
  async function changeEmail(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    setBusy(true);
    try {
      await settingsApi.requestEmailChange(emailPassword, newEmail.trim());
      setEmailPassword('');
      setMessage('Check your new email for a confirmation link.');
      showFlash({ type: 'info', message: 'Check your new email for a confirmation link.' });
    } catch (error) {
      setMessage(apiErrorMessage(error));
      showFlash({ type: 'error', message: apiErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }
  async function deactivate(event: FormEvent) {
    event.preventDefault();
    if (!window.confirm('Deactivate this account and sign out of every device?')) return;
    setMessage('');
    setBusy(true);
    try {
      await settingsApi.deactivate(deactivatePassword);
      await clearAuthenticatedCache(client);
      navigate('/login', { replace: true });
    } catch (error) {
      setMessage(apiErrorMessage(error));
      showFlash({ type: 'error', message: apiErrorMessage(error) });
      setBusy(false);
    }
  }
  return (
    <div className="settings-page">
      <Link to="/app/settings">← Settings</Link>
      <h1>Account</h1>
      {query.isPending ? (
        <p role="status">Loading account…</p>
      ) : query.isError ? (
        <p role="alert">Account settings unavailable.</p>
      ) : (
        <>
          <section className="settings-panel">
            <h2>Account information</h2>
            <form onSubmit={(event) => void saveName(event)}>
              <label htmlFor="account-name">Display name</label>
              <input
                id="account-name"
                value={name}
                minLength={2}
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
                required
              />
              <label>Email address</label>
              <p>{query.data.email}</p>
              <p>Joined {new Date(query.data.createdAt).toLocaleDateString()}</p>
              {query.data.publicProfileUrl && (
                <Link to={query.data.publicProfileUrl}>View public profile</Link>
              )}
              <button type="submit" disabled={actions.updateAccount.isPending}>
                Save name
              </button>
            </form>
          </section>
          <section className="settings-panel">
            <h2>Change email</h2>
            {query.data.emailChangeAvailable ? (
              <form onSubmit={(event) => void changeEmail(event)}>
                <p>
                  We will send a single-use link to your new address. Your current email stays active until
                  you confirm it. Confirmation signs you out everywhere.
                </p>
                <label htmlFor="new-email">New email</label>
                <input
                  id="new-email"
                  type="email"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  required
                />
                <label htmlFor="email-current-password">Current password</label>
                <input
                  id="email-current-password"
                  type="password"
                  value={emailPassword}
                  onChange={(event) => setEmailPassword(event.target.value)}
                  required
                />
                <button type="submit" disabled={busy}>
                  Send confirmation
                </button>
              </form>
            ) : (
              <p>Email changes require configured email delivery and are currently unavailable.</p>
            )}
          </section>
          <section className="settings-panel settings-danger">
            <h2>Deactivate account</h2>
            <p>
              This hides your account and signs out every device. Your content and privacy choices are
              retained. You can reactivate with your email and password.
            </p>
            <form onSubmit={(event) => void deactivate(event)}>
              <label htmlFor="deactivate-password">Current password</label>
              <input
                id="deactivate-password"
                type="password"
                value={deactivatePassword}
                onChange={(event) => setDeactivatePassword(event.target.value)}
                required
              />
              <button type="submit" disabled={busy}>
                Deactivate account
              </button>
            </form>
          </section>
        </>
      )}
      {message && (
        <p className="settings-message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
