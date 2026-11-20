import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { apiErrorMessage } from '@/lib/apiClient';
import { settingsApi } from '../api/settingsApi';
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await settingsApi.forgotPassword(email.trim());
      setMessage('If this account is eligible, a reset link has been sent.');
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="auth-secondary-page">
      <h2>Forgot password</h2>
      <p>Enter your account email to request a reset link.</p>
      <form onSubmit={(event) => void submit(event)}>
        <label htmlFor="forgot-email">Email address</label>
        <input
          id="forgot-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <button type="submit" disabled={busy}>
          Send reset link
        </button>
      </form>
      {message && <p role="status">{message}</p>}
      <Link to="/login">Return to sign in</Link>
    </section>
  );
}
