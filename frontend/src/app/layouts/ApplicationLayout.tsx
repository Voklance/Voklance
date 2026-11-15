import type { AuthUser } from '@voklance/shared';
import { Outlet } from 'react-router';
import TopNavigation from '@/components/navigation/TopNavigation';
import SideNavigation from '@/components/navigation/SideNavigation';
import ProfileSidebar from '@/components/shared/ProfileSidebar';
import { apiErrorMessage } from '@/lib/apiClient';
import { useSignOut } from '@/features/auth/hooks/useSignOut';

export default function ApplicationLayout({ user }: { user: AuthUser }) {
  const signOut = useSignOut();

  return (
    <div className="dashboard-shell">
      <TopNavigation user={user} />
      <div className="dashboard-layout">
        <SideNavigation signingOut={signOut.isPending} onSignOut={() => signOut.mutate()} />
        <main className="dashboard-main">
          {signOut.isError && (
            <p className="form-alert" role="alert">
              {apiErrorMessage(signOut.error)}
            </p>
          )}
          <Outlet />
        </main>
        <ProfileSidebar user={user} />
      </div>
    </div>
  );
}
