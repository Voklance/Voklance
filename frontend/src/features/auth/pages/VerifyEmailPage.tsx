import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { authApi } from '../api/authApi';
import { emailVerificationApi } from '../api/emailVerificationApi';
import { currentUserKey } from '../cache/authCache';

type Status = 'loading' | 'success' | 'invalid' | 'network' | 'disabled';

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<Status>('loading');
  const [destination, setDestination] = useState('/login');
  const once = useRef(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (once.current) return;
    once.current = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    if (!token) {
      setStatus('invalid');
      return;
    }
    void (async () => {
      try {
        await emailVerificationApi.verify(token);
        const user = await authApi.currentUser().catch(() => null);
        queryClient.setQueryData(currentUserKey, user);
        setDestination(user ? (user.onboardingStatus === 'COMPLETED' ? '/app' : '/onboarding') : '/login');
        setStatus('success');
        if (user) navigate(user.onboardingStatus === 'COMPLETED' ? '/app' : '/onboarding', { replace: true });
      } catch (error) {
        const response =
          error && typeof error === 'object' && 'response' in error
            ? (error as { response?: { status?: number; data?: { error?: { code?: string } } } }).response
            : undefined;
        setStatus(
          response?.data?.error?.code === 'EMAIL_VERIFICATION_DISABLED'
            ? 'disabled'
            : response?.status === 400
              ? 'invalid'
              : 'network'
        );
      }
    })();
  }, [navigate, queryClient]);

  return (
    <section aria-live="polite">
      <h2>
        {status === 'loading'
          ? 'Verifying your email…'
          : status === 'success'
            ? 'Email verified'
            : status === 'invalid'
              ? 'Verification link unavailable'
              : status === 'disabled'
                ? 'Email verification is paused'
                : 'Could not verify your email'}
      </h2>
      <p>
        {status === 'loading'
          ? 'Please wait while we verify your link.'
          : status === 'success'
            ? 'Your email is verified. Continue to your account.'
            : status === 'invalid'
              ? 'This link is invalid, expired, or has already been used. Sign in to request another link.'
              : status === 'disabled'
                ? 'Email verification is currently unavailable. You can continue by signing in.'
                : 'A network error prevented verification. Sign in and request another link if needed.'}
      </p>
      {status !== 'loading' && (
        <Link className="submit-button" to={destination}>
          {destination === '/login' ? 'Sign in' : 'Continue'}
        </Link>
      )}
    </section>
  );
}
