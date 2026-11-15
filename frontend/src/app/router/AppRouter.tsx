import { Navigate, Route, Routes, useLocation } from 'react-router';
import axios from 'axios';
import AuthLayout from '@/app/layouts/AuthLayout';
import ApplicationLayout from '@/app/layouts/ApplicationLayout';
import ErrorState from '@/components/shared/ErrorState';
import LoadingState from '@/components/shared/LoadingState';
import CommunityDiscoveryPage from '@/features/communities/pages/CommunityDiscoveryPage';
import CreateCommunityPage from '@/features/communities/pages/CreateCommunityPage';
import CommunityDetailPage from '@/features/communities/pages/CommunityDetailPage';
import CommunityMembersPage from '@/features/communities/pages/CommunityMembersPage';
import CommunityRequestsPage from '@/features/communities/pages/CommunityRequestsPage';
import CommunitySettingsPage from '@/features/communities/pages/CommunitySettingsPage';
import HomePage from '@/features/feed/pages/HomePage';
import SavedPostsPage from '@/features/feed/pages/SavedPostsPage';
import LoginPage from '@/features/auth/pages/LoginPage';
import SignupPage from '@/features/auth/pages/SignupPage';
import VerificationRequiredPage from '@/features/auth/pages/VerificationRequiredPage';
import VerifyEmailPage from '@/features/auth/pages/VerifyEmailPage';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useSignOut } from '@/features/auth/hooks/useSignOut';
import OnboardingPage from '@/features/onboarding/pages/OnboardingPage';
import MyProfilePage from '@/features/profiles/pages/MyProfilePage';
import EditProfilePage from '@/features/profiles/pages/EditProfilePage';
import PublicProfilePage from '@/features/profiles/pages/PublicProfilePage';
import MyReferralsPage from '@/features/referrals/pages/MyReferralsPage';
import ReferralOpportunityPage from '@/features/referrals/pages/ReferralOpportunityPage';
import ReferralNeedPage from '@/features/referrals/pages/ReferralNeedPage';

type Access = 'root' | 'public' | 'verification' | 'onboarding' | 'app' | 'legacy';

function AccountUnavailable({ onRetry }: { onRetry: () => void }) {
  const signOut = useSignOut();
  return (
    <section className="error-state" role="alert">
      <h1>Account unavailable.</h1>
      <p>This account cannot access Voklance right now. You can sign out or try again.</p>
      <button
        type="button"
        className="submit-button"
        onClick={() => signOut.mutate()}
        disabled={signOut.isPending}
      >
        Sign out
      </button>
      <button type="button" className="onboarding-text-button" onClick={onRetry}>
        Try again
      </button>
      {signOut.isError && <p>Sign out could not be completed. Please try again.</p>}
    </section>
  );
}

function AccessGate({ access }: { access: Access }) {
  const account = useCurrentUser();
  const location = useLocation();
  if (account.isPending) return <LoadingState label="Checking your account…" />;
  if (account.isError) {
    if (axios.isAxiosError(account.error) && account.error.response?.status === 403)
      return <AccountUnavailable onRetry={() => void account.refetch()} />;
    const message =
      axios.isAxiosError(account.error) && account.error.response?.status === 503
        ? 'The account service is temporarily unavailable. Please try again.'
        : 'We couldn’t check your account. Check your connection and try again.';
    return <ErrorState message={message} onRetry={() => void account.refetch()} />;
  }
  if (!account.data) return access === 'public' ? <AuthLayout /> : <Navigate to="/login" replace />;
  if (account.data.accountStatus !== 'ACTIVE')
    return <AccountUnavailable onRetry={() => void account.refetch()} />;

  const completed = account.data.onboardingStatus === 'COMPLETED';
  const verificationRequired =
    account.data.emailVerificationRequired === true && !account.data.emailVerifiedAt;
  if (verificationRequired)
    return access === 'verification' ? (
      <AuthLayout>
        <VerificationRequiredPage user={account.data} />
      </AuthLayout>
    ) : (
      <Navigate to="/verify-email-required" replace />
    );
  if (access === 'verification') return <Navigate to={completed ? '/app' : '/onboarding'} replace />;
  if (access === 'public' || access === 'root')
    return <Navigate to={completed ? '/app' : '/onboarding'} replace />;
  if (access === 'onboarding') return completed ? <Navigate to="/app" replace /> : <OnboardingPage />;
  if (!completed) return <Navigate to="/onboarding" replace />;
  if (access === 'legacy')
    return <Navigate to={location.search.includes('communities') ? '/app/communities' : '/app'} replace />;
  return <ApplicationLayout user={account.data} />;
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<AccessGate access="root" />} />
      <Route element={<AccessGate access="public" />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Route>
      <Route
        path="/verify-email"
        element={
          <AuthLayout>
            <VerifyEmailPage />
          </AuthLayout>
        }
      />
      <Route path="/verify-email-required" element={<AccessGate access="verification" />} />
      <Route path="/onboarding" element={<AccessGate access="onboarding" />} />
      <Route path="/app" element={<AccessGate access="app" />}>
        <Route index element={<HomePage />} />
        <Route path="saved" element={<SavedPostsPage />} />
        <Route path="communities" element={<CommunityDiscoveryPage />} />
        <Route path="communities/create" element={<CreateCommunityPage />} />
        <Route path="communities/:slug" element={<CommunityDetailPage />} />
        <Route path="communities/:slug/members" element={<CommunityMembersPage />} />
        <Route path="communities/:slug/requests" element={<CommunityRequestsPage />} />
        <Route path="communities/:slug/settings" element={<CommunitySettingsPage />} />
        <Route path="referrals" element={<MyReferralsPage />} />
        <Route path="referrals/opportunities/:opportunityId" element={<ReferralOpportunityPage />} />
        <Route path="referrals/needs/:needId" element={<ReferralNeedPage />} />
        <Route path="profile" element={<MyProfilePage />} />
        <Route path="profile/edit" element={<EditProfilePage />} />
        <Route path="professionals/:username" element={<PublicProfilePage />} />
      </Route>
      <Route path="/account" element={<AccessGate access="legacy" />} />
      <Route path="*" element={<ErrorState message="The page you requested does not exist." />} />
    </Routes>
  );
}
