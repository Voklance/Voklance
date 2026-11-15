import { Link } from 'react-router';
import type { ReactNode } from 'react';
import logo from '@/assets/Voklanceimage.png';
import { useSignOut } from '@/features/auth/hooks/useSignOut';
import { apiErrorMessage } from '@/lib/apiClient';

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  const signOut = useSignOut();
  return (
    <div className="onboarding-shell">
      <header className="onboarding-header">
        <Link to="/onboarding" className="brand" aria-label="Voklance onboarding">
          <img src={logo} alt="Voklance" />
        </Link>
        <span>Professional profile setup</span>
        <button
          type="button"
          className="onboarding-exit"
          disabled={signOut.isPending}
          onClick={() => signOut.mutate()}
        >
          {signOut.isPending ? 'Signing out…' : 'Sign out'}
        </button>
      </header>
      {signOut.isError && (
        <p className="form-alert" role="alert">
          {apiErrorMessage(signOut.error)}
        </p>
      )}
      <main className="onboarding-main">{children}</main>
    </div>
  );
}
