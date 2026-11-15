import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { AuthUser } from '@voklance/shared';
import { apiErrorMessage } from '@/lib/apiClient';
import { currentUserKey } from '../cache/authCache';
import { emailVerificationApi } from '../api/emailVerificationApi';
import { useSignOut } from '../hooks/useSignOut';

export default function VerificationRequiredPage({ user }: { user: AuthUser }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const signOut = useSignOut();
  const [remaining, setRemaining] = useState(0);
  const [feedback, setFeedback] = useState('');
  const deliveryFailed =
    (location.state as { verificationEmailSent?: boolean } | null)?.verificationEmailSent === false;
  const resend = useMutation({
    mutationFn: emailVerificationApi.resend,
    onSuccess() {
      setFeedback('Verification email accepted for delivery. Check your inbox and spam folder.');
      setRemaining(60);
    },
    onError(error) {
      setFeedback(apiErrorMessage(error));
    }
  });

  useEffect(() => {
    if (!remaining) return;
    const timer = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [remaining]);

  return (
    <section aria-labelledby="verify-required-title">
      <h2 id="verify-required-title">Verify your email address</h2>
      <p className="form-intro">
        Your account is ready. Verify <strong>{user.email}</strong> to continue to your professional profile.
      </p>
      <p>Check your inbox and click the verification link. You may also need to check your spam folder.</p>
      {deliveryFailed && (
        <p className="form-alert" role="alert">
          The first email could not be sent. Check your mail service, then request another link.
        </p>
      )}
      {feedback && <p role="status">{feedback}</p>}
      <button
        className="submit-button"
        type="button"
        disabled={resend.isPending || remaining > 0}
        onClick={() => resend.mutate()}
      >
        {resend.isPending
          ? 'Sending…'
          : remaining > 0
            ? `Resend available in ${remaining}s`
            : 'Resend verification email'}
      </button>
      <button
        className="onboarding-text-button"
        type="button"
        disabled={signOut.isPending}
        onClick={() => signOut.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) })}
      >
        Log out
      </button>
      {signOut.isError && <p role="alert">Sign out could not be completed. Please try again.</p>}
      <button
        className="onboarding-text-button"
        type="button"
        onClick={() => void queryClient.invalidateQueries({ queryKey: currentUserKey })}
      >
        I have verified my email
      </button>
    </section>
  );
}
