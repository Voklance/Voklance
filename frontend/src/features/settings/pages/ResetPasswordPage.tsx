import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { apiErrorMessage } from '@/lib/apiClient';
import { settingsApi } from '../api/settingsApi';
export default function ResetPasswordPage() {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '');
  useEffect(() => {
    if (window.location.hash)
      window.history.replaceState({}, '', window.location.pathname + window.location.search);
  }, []);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await settingsApi.resetPassword(token, newPassword, confirmPassword);
      setNewPassword('');
      setConfirmPassword('');
      setDone(true);
      setMessage('Password reset. Sign in with your new password.');
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="auth-secondary-page">
      <h2>Reset password</h2>
      {!token ? (
        <p role="alert">This reset link is missing or invalid.</p>
      ) : done ? (
        <p role="status">{message}</p>
      ) : (
        <form onSubmit={(event) => void submit(event)}>
          <p>Choose a new password of at least twelve characters.</p>
          <label htmlFor="reset-new">New password</label>
          <input
            id="reset-new"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
          <label htmlFor="reset-confirm">Confirm new password</label>
          <input
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
          <button type="submit" disabled={busy}>
            Reset password
          </button>
        </form>
      )}
      {message && !done && <p role="alert">{message}</p>}
      <Link to="/login">Return to sign in</Link>
    </section>
  );
}
