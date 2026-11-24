import type { AuthUser } from '@voklance/shared';
import { Outlet, useLocation } from 'react-router';
import { useEffect, useState } from 'react';
import TopNavigation from '@/components/navigation/TopNavigation';
import SideNavigation from '@/components/navigation/SideNavigation';
import ProfileSidebar from '@/components/shared/ProfileSidebar';
import { apiErrorMessage } from '@/lib/apiClient';
import { useSignOut } from '@/features/auth/hooks/useSignOut';
import { useMessagingLifecycle } from '@/features/messaging/hooks/useMessaging';
import { useNotificationRealtime } from '@/features/notifications/hooks/useNotifications';
import { notificationTarget } from '@/features/notifications/components/NotificationCard';
import { useFlash } from '@/components/shared/FlashMessages';

export default function ApplicationLayout({ user }: { user: AuthUser }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const isProfilePage =
    location.pathname.startsWith('/app/profile') || location.pathname.startsWith('/app/professionals/');
  const isProfileView =
    location.pathname === '/app/profile' || location.pathname.startsWith('/app/professionals/');
  const isCommunityChat =
    location.pathname === '/app/community-chat' ||
    /^\/app\/communities\/[^/]+\/chat$/.test(location.pathname);
  const signOut = useSignOut();
  const { showFlash } = useFlash();
  useMessagingLifecycle(user.id);
  const { notice, dismiss } = useNotificationRealtime(user.id);
  useEffect(() => {
    if (!notice) return;
    showFlash({
      type: 'info',
      title: notice.title,
      message: notice.body,
      to: notificationTarget(notice)
    });
    dismiss();
  }, [notice, dismiss, showFlash]);
  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => {
    if (!window.matchMedia) return;
    const wide = window.matchMedia('(min-width: 901px)');
    const closeOnWide = () => {
      if (wide.matches) setMenuOpen(false);
    };
    wide.addEventListener('change', closeOnWide);
    return () => wide.removeEventListener('change', closeOnWide);
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const navigation = document.getElementById('main-navigation');
    navigation?.querySelector<HTMLAnchorElement>('a')?.focus();
    const handleMenuKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        document.querySelector<HTMLButtonElement>('.mobile-menu-toggle')?.focus();
      }
      if (event.key !== 'Tab' || !navigation) return;
      const controls = Array.from(navigation.querySelectorAll<HTMLElement>('a, button:not(:disabled)'));
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleMenuKeys);
    document.body.classList.add('mobile-menu-open');
    return () => {
      document.removeEventListener('keydown', handleMenuKeys);
      document.body.classList.remove('mobile-menu-open');
    };
  }, [menuOpen]);

  return (
    <div className="dashboard-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <TopNavigation
        user={user}
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen((open) => !open)}
        onSignOut={() => signOut.mutate()}
        signingOut={signOut.isPending}
      />
      {menuOpen && (
        <button
          type="button"
          className="mobile-nav-backdrop"
          onClick={() => setMenuOpen(false)}
          aria-label="Close navigation"
          tabIndex={-1}
        />
      )}
      <div
        className={`dashboard-layout${isProfilePage ? ' dashboard-layout--profile' : ''}${isProfileView ? ' dashboard-layout--profile-view' : ''}${isCommunityChat ? ' dashboard-layout--community-chat' : ''}`}
      >
        <SideNavigation
          signingOut={signOut.isPending}
          onSignOut={() => signOut.mutate()}
          mobileOpen={menuOpen}
          onNavigate={() => setMenuOpen(false)}
        />
        <main className="dashboard-main" id="main-content" tabIndex={-1}>
          {signOut.isError && (
            <p className="form-alert" role="alert">
              {apiErrorMessage(signOut.error)}
            </p>
          )}
          <Outlet />
        </main>
        {!isProfilePage && !isCommunityChat && <ProfileSidebar user={user} />}
      </div>
    </div>
  );
}
