import { Navigate, Route, Routes, useLocation } from 'react-router';
import axios from 'axios';
import AuthLayout from '@/app/layouts/AuthLayout';
import ApplicationLayout from '@/app/layouts/ApplicationLayout';
import ErrorState from '@/components/shared/ErrorState';
import LoadingState from '@/components/shared/LoadingState';
import CommunityDiscoveryPage from '@/features/communities/pages/CommunityDiscoveryPage';
import CreateCommunityPage from '@/features/communities/pages/CreateCommunityPage';
import CommunityDetailPage from '@/features/communities/pages/CommunityDetailPage';
import CommunityChatPage from '@/features/communities/pages/CommunityChatPage';
import CommunityInboxPage from '@/features/communities/pages/CommunityInboxPage';
import CommunityMembersPage from '@/features/communities/pages/CommunityMembersPage';
import CommunityRequestsPage from '@/features/communities/pages/CommunityRequestsPage';
import CommunitySettingsPage from '@/features/communities/pages/CommunitySettingsPage';
import HomePage from '@/features/feed/pages/HomePage';
import PostDetailPage from '@/features/feed/pages/PostDetailPage';
import SavedItemsPage from '@/features/bookmarks/pages/SavedItemsPage';
import ActivityPage from '@/features/bookmarks/pages/ActivityPage';
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
import ReferralOpportunityPage from '@/features/referrals/pages/ReferralOpportunityPage';
import ReferralNeedPage from '@/features/referrals/pages/ReferralNeedPage';
import EventDetailPage from '@/features/events/pages/EventDetailPage';
import EventEditPage from '@/features/events/pages/EventEditPage';
import CommunityResourcesPage from '@/features/resources/pages/CommunityResourcesPage';
import ResourceDetailPage from '@/features/resources/pages/ResourceDetailPage';
import MyNetworkPage from '@/features/connections/pages/MyNetworkPage';
import ProfessionalDiscoveryPage from '@/features/connections/pages/ProfessionalDiscoveryPage';
import MessagesPage from '@/features/messaging/pages/MessagesPage';
import NotificationsPage from '@/features/notifications/pages/NotificationsPage';
import NotificationSettingsPage from '@/features/notifications/pages/NotificationSettingsPage';
import GitHubPage from '@/features/github/pages/GitHubPage';
import SearchPage from '@/features/search/pages/SearchPage';
import RecommendationPage from '@/features/recommendations/pages/RecommendationPage';
import FeedPreferencesPage from '@/features/recommendations/pages/FeedPreferencesPage';
import SettingsOverviewPage from '@/features/settings/pages/SettingsOverviewPage';
import AccountSettingsPage from '@/features/settings/pages/AccountSettingsPage';
import SecuritySettingsPage from '@/features/settings/pages/SecuritySettingsPage';
import PrivacySettingsPage from '@/features/settings/pages/PrivacySettingsPage';
import BlockedUsersPage from '@/features/settings/pages/BlockedUsersPage';
import DataSettingsPage from '@/features/settings/pages/DataSettingsPage';
import ForgotPasswordPage from '@/features/settings/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/features/settings/pages/ResetPasswordPage';
import ReactivatePage from '@/features/settings/pages/ReactivatePage';
import ConfirmEmailChangePage from '@/features/settings/pages/ConfirmEmailChangePage';
import VisitorProfilePage from '@/features/profiles/pages/VisitorProfilePage';

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
      <Route path="/u/:username" element={<VisitorProfilePage />} />
      <Route path="/" element={<AccessGate access="root" />} />
      <Route element={<AccessGate access="public" />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/reactivate" element={<ReactivatePage />} />
      </Route>
      <Route path="/confirm-email-change" element={<ConfirmEmailChangePage />} />
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
        <Route path="posts/:postId" element={<PostDetailPage />} />
        <Route path="saved" element={<SavedItemsPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="communities" element={<CommunityDiscoveryPage />} />
        <Route path="community-chat" element={<CommunityInboxPage />} />
        <Route path="communities/create" element={<CreateCommunityPage />} />
        <Route path="communities/:slug" element={<CommunityDetailPage />} />
        <Route path="communities/:slug/chat" element={<CommunityChatPage />} />
        <Route path="communities/:slug/resources" element={<CommunityResourcesPage />} />
        <Route path="communities/:slug/members" element={<CommunityMembersPage />} />
        <Route path="communities/:slug/requests" element={<CommunityRequestsPage />} />
        <Route path="communities/:slug/settings" element={<CommunitySettingsPage />} />
        <Route path="referrals/opportunities/:opportunityId" element={<ReferralOpportunityPage />} />
        <Route path="referrals/needs/:needId" element={<ReferralNeedPage />} />
        <Route path="events/:eventId" element={<EventDetailPage />} />
        <Route path="events/:eventId/edit" element={<EventEditPage />} />
        <Route path="resources/:resourceId" element={<ResourceDetailPage />} />
        <Route path="profile" element={<MyProfilePage />} />
        <Route path="profile/edit" element={<EditProfilePage />} />
        <Route path="network" element={<MyNetworkPage />} />
        <Route path="network/discover" element={<ProfessionalDiscoveryPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="messages/:conversationId" element={<MessagesPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="notifications/settings" element={<NotificationSettingsPage />} />
        <Route path="github" element={<GitHubPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="recommendations/:category" element={<RecommendationPage />} />
        <Route path="settings/feed" element={<FeedPreferencesPage />} />
        <Route path="settings" element={<SettingsOverviewPage />} />
        <Route path="settings/account" element={<AccountSettingsPage />} />
        <Route path="settings/security" element={<SecuritySettingsPage />} />
        <Route path="settings/privacy" element={<PrivacySettingsPage />} />
        <Route path="settings/blocked-users" element={<BlockedUsersPage />} />
        <Route path="settings/data" element={<DataSettingsPage />} />
        <Route path="professionals/:username" element={<PublicProfilePage />} />
      </Route>
      <Route path="/account" element={<AccessGate access="legacy" />} />
      <Route path="*" element={<ErrorState message="The page you requested does not exist." />} />
    </Routes>
  );
}
