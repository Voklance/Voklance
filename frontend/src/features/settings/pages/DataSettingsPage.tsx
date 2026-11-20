import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { apiErrorMessage } from '@/lib/apiClient';
import { settingsApi } from '../api/settingsApi';
export default function DataSettingsPage() {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function download(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const blob = await settingsApi.exportData(password);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'voklance-data.json';
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setPassword('');
      setMessage('Your data download is ready.');
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settings-page">
      <Link to="/app/settings">← Settings</Link>
      <h1>Your data</h1>
      <section className="settings-panel">
        <h2>Download personal data</h2>
        <p>
          Download your account, profile, authored content, selected preferences, memberships, and your own
          sent messages as JSON. Password hashes and session secrets are excluded. Large exports may require
          support.
        </p>
        <form onSubmit={(event) => void download(event)}>
          <label htmlFor="export-password">Current password</label>
          <input
            id="export-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button type="submit" disabled={busy}>
            Download my data
          </button>
        </form>
      </section>
      <section className="settings-panel settings-danger">
        <h2>Permanent deletion</h2>
        <p>
          Permanent deletion is currently unavailable while a safe cleanup process for shared communities,
          conversations, and related data is being developed. Contact support for an account data request. You
          can temporarily deactivate your account from Account settings.
        </p>
        <Link to="/app/settings/account">Account settings</Link>
      </section>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
