import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '@/lib/apiClient';
import { clearAuthenticatedCache } from '@/features/auth/cache/authCache';
import { settingsApi } from '../api/settingsApi';
export default function ConfirmEmailChangePage() {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '');
  useEffect(() => {
    if (window.location.hash)
      window.history.replaceState({}, '', window.location.pathname + window.location.search);
  }, []);
  const client = useQueryClient();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function confirm() {
    setBusy(true);
    try {
      await settingsApi.confirmEmailChange(token);
      await clearAuthenticatedCache(client);
      setMessage('Email confirmed. Sign in with your new address.');
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="auth-secondary-page">
      <h2>Confirm email change</h2>
      {token ? (
        <>
          <p>
            You must be signed in to the account that requested this change. Confirmation signs out every
            device.
          </p>
          <button type="button" disabled={busy} onClick={() => void confirm()}>
            Confirm new email
          </button>
        </>
      ) : (
        <p role="alert">This confirmation link is missing or invalid.</p>
      )}
      {message && <p role="status">{message}</p>}
      <Link to="/login">Sign in</Link>
    </section>
  );
}
