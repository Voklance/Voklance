import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { apiErrorMessage } from '@/lib/apiClient';
import { authApi } from '@/features/auth/api/authApi';
import { currentUserKey, prepareAuthenticatedCache } from '@/features/auth/cache/authCache';
import { settingsApi } from '../api/settingsApi';
export default function ReactivatePage() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await settingsApi.reactivate(email.trim(), password);
      await prepareAuthenticatedCache(client);
      const user = await authApi.currentUser();
      if (!user) throw new Error('Session could not be confirmed.');
      client.setQueryData(currentUserKey, user);
      setPassword('');
      navigate(user.onboardingStatus === 'COMPLETED' ? '/app' : '/onboarding', { replace: true });
    } catch (error) {
      setMessage(apiErrorMessage(error));
      setBusy(false);
    }
  }
  return (
    <section className="auth-secondary-page">
      <h2>Reactivate account</h2>
      <p>
        Sign in with the email and password of your deactivated account. Suspended and deleted accounts cannot
        use this form.
      </p>
      <form onSubmit={(event) => void submit(event)}>
        <label htmlFor="reactivate-email">Email address</label>
        <input
          id="reactivate-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <label htmlFor="reactivate-password">Password</label>
        <input
          id="reactivate-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <button type="submit" disabled={busy}>
          Reactivate account
        </button>
      </form>
      {message && <p role="alert">{message}</p>}
      <Link to="/login">Return to sign in</Link>
    </section>
  );
}
