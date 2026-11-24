import { NavLink } from 'react-router';
import { useNetworkCounts } from '@/features/connections/hooks/useNetwork';
import { useUnreadMessageCount } from '@/features/messaging/hooks/useMessaging';

type NavigationIcon =
  | 'home'
  | 'communities'
  | 'community-chat'
  | 'profile'
  | 'network'
  | 'messages'
  | 'saved'
  | 'activity'
  | 'settings';

const links: { to: string; label: string; icon: NavigationIcon; end?: boolean }[] = [
  { to: '/app', label: 'Home', icon: 'home', end: true },
  { to: '/app/communities', label: 'Communities', icon: 'communities' },
  { to: '/app/community-chat', label: 'Community chat', icon: 'community-chat' },
  { to: '/app/profile', label: 'Profile', icon: 'profile' },
  { to: '/app/network', label: 'My Network', icon: 'network' },
  { to: '/app/messages', label: 'Messages', icon: 'messages' },
  { to: '/app/saved', label: 'Saved items', icon: 'saved' },
  { to: '/app/activity', label: 'Your activity', icon: 'activity' },
  { to: '/app/settings', label: 'Settings', icon: 'settings' }
];

function Icon({ name }: { name: NavigationIcon }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {name === 'home' && (
        <>
          <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z" />
          <path className="sidebar-home-door" d="M9 21v-7h6v7" />
        </>
      )}
      {name === 'communities' && (
        <>
          <circle cx="9" cy="8" r="3" />
          <path d="M2 20v-1.5a7 7 0 0 1 14 0V20H2ZM17 5a3 3 0 0 1 0 6m1 3a5 5 0 0 1 4 5v1h-4" />
        </>
      )}
      {name === 'community-chat' && (
        <>
          <path d="M20.5 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-3.8-.8L3 21l1.7-5.1A8.5 8.5 0 1 1 20.5 11.5Z" />
          <path d="M8 10h8M8 13.5h5" />
        </>
      )}
      {name === 'profile' && (
        <>
          <circle cx="12" cy="7" r="4" />
          <path d="M4 21v-1a8 8 0 0 1 16 0v1H4Z" />
        </>
      )}
      {name === 'network' && (
        <>
          <circle cx="12" cy="4" r="2.5" />
          <circle cx="5" cy="18" r="2.5" />
          <circle cx="19" cy="18" r="2.5" />
          <path d="m10.8 6.3-4.5 9.4m6.9-9.4 4.5 9.4M7.5 18h9" />
        </>
      )}
      {name === 'messages' && (
        <path d="M20.5 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-3.8-.8L3 21l1.7-5.1A8.5 8.5 0 1 1 20.5 11.5Z" />
      )}
      {name === 'saved' && <path d="M5 3h14v18l-7-4-7 4V3Z" />}
      {name === 'activity' && (
        <>
          <rect x="3" y="14" width="4" height="7" rx="1" />
          <rect x="10" y="9" width="4" height="12" rx="1" />
          <rect x="17" y="3" width="4" height="18" rx="1" />
        </>
      )}
      {name === 'settings' && (
        <>
          <path d="m10 2-.5 2.1a8 8 0 0 0-1.8.8L5.8 4 4 5.8l.9 1.9a8 8 0 0 0-.8 1.8L2 10v4l2.1.5c.2.6.5 1.2.8 1.8L4 18.2 5.8 20l1.9-.9c.6.3 1.2.6 1.8.8L10 22h4l.5-2.1c.6-.2 1.2-.5 1.8-.8l1.9.9 1.8-1.8-.9-1.9c.3-.6.6-1.2.8-1.8L22 14v-4l-2.1-.5a8 8 0 0 0-.8-1.8l.9-1.9L18.2 4l-1.9.9a8 8 0 0 0-1.8-.8L14 2h-4Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

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
  const incoming = network.data?.counts.incoming ?? 0;
  const unreadMessages = messages.data?.count ?? 0;
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
        {links.map(({ to, label, icon, end }) => {
          const count = icon === 'network' ? incoming : icon === 'messages' ? unreadMessages : 0;
          const countLabel = icon === 'network' ? 'received requests' : 'unread messages';
          return (
            <NavLink
              key={to}
              end={end}
              to={to}
              title={label}
              aria-label={count ? `${label}, ${count} ${countLabel}` : label}
              className={({ isActive }) =>
                `sidebar-link${icon === 'network' ? ' sidebar-link-mobile-only' : ''}${isActive ? ' active' : ''}`
              }
            >
              <span className="sidebar-link-icon">
                <Icon name={icon} />
              </span>
              <span className="sidebar-link-label" aria-hidden="true">
                {label}
              </span>
              {count > 0 && (
                <span className="sidebar-link-count" aria-hidden="true">
                  {count}
                </span>
              )}
            </NavLink>
          );
        })}
      </div>
      <button className="signout-link" type="button" onClick={onSignOut} disabled={signingOut}>
        {signingOut ? 'Signing out…' : 'Sign out'}
      </button>
    </nav>
  );
}
