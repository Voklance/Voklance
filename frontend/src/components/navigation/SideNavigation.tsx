import { NavLink } from 'react-router';
import { useNetworkCounts } from '@/features/connections/hooks/useNetwork';
import { useUnreadMessageCount } from '@/features/messaging/hooks/useMessaging';

interface SideNavigationProps {
  onSignOut: () => void;
  signingOut: boolean;
  mobileOpen?: boolean;
  onNavigate?: () => void;
}

export default function SideNavigation({
  onSignOut,
  signingOut,
  mobileOpen = false,
  onNavigate = () => {}
}: SideNavigationProps) {
  const network = useNetworkCounts();
  const messages = useUnreadMessageCount();
  return (
    <nav
      id="main-navigation"
      className={`dashboard-sidebar${mobileOpen ? ' mobile-open' : ''}`}
      aria-label="Main navigation"
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('a')) onNavigate();
      }}
    >
      <div className="sidebar-links">
        <NavLink end to="/app" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          Home
        </NavLink>
        <NavLink
          to="/app/communities"
          className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
        >
          Communities
        </NavLink>
        <NavLink to="/app/profile" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          Profile
        </NavLink>
        <NavLink to="/app/network" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          My Network{' '}
          {network.data?.counts.incoming ? (
            <span aria-label={`${network.data.counts.incoming} received requests`}>
              ({network.data.counts.incoming})
            </span>
          ) : null}
        </NavLink>
        <NavLink to="/app/messages" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          Messages{' '}
          {messages.data?.count ? (
            <span aria-label={`${messages.data.count} unread messages`}>({messages.data.count})</span>
          ) : null}
        </NavLink>
        <NavLink to="/app/referrals" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          My referrals
        </NavLink>
        <NavLink to="/app/events" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          Events
        </NavLink>
        <NavLink to="/app/resources" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          My resources
        </NavLink>
        <NavLink to="/app/saved" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          Saved items
        </NavLink>
        <NavLink to="/app/activity" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          Your activity
        </NavLink>
        <NavLink to="/app/settings" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          Settings
        </NavLink>
      </div>
      <button className="signout-link" type="button" onClick={onSignOut} disabled={signingOut}>
        {signingOut ? 'Signing out…' : 'Sign out'}
      </button>
    </nav>
  );
}
