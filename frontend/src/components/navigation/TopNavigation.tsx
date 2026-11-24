import type { AuthUser } from '@voklance/shared';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router';
import voklanceLogo from '@/assets/Voklanceimage.png';
import NotificationBell from '@/features/notifications/components/NotificationBell';
import GlobalSearch from '@/features/search/components/GlobalSearch';
import { useMyProfile } from '@/features/profiles/hooks/useProfileData';
import { mediaUrl } from '@/lib/mediaUrl';

export default function TopNavigation({
  user,
  menuOpen,
  onMenuToggle,
  onSignOut,
  signingOut
}: {
  user: AuthUser;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  const initial = user.name.trim().charAt(0).toUpperCase();
  const avatarUrl = useMyProfile().data?.profile?.avatarUrl;
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRoot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountOpen(false);
    };
    const closeOutside = (event: MouseEvent) => {
      if (accountRoot.current && !accountRoot.current.contains(event.target as Node)) setAccountOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('mousedown', closeOutside);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('mousedown', closeOutside);
    };
  }, [accountOpen]);

  return (
    <header className="dashboard-topbar">
      <button
        type="button"
        className="mobile-menu-toggle"
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={menuOpen}
        aria-controls="main-navigation"
        onClick={onMenuToggle}
      >
        {menuOpen ? '×' : '☰'}
      </button>
      <Link className="brand dashboard-brand" to="/app" aria-label="Voklance home">
        <img src={voklanceLogo} alt="Voklance" />
      </Link>
      <nav className="header-quick-nav" aria-label="Quick navigation">
        <NavLink end to="/app" className={({ isActive }) => `header-nav-link${isActive ? ' active' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z" />
          </svg>
          Home
        </NavLink>
        <NavLink
          to="/app/messages"
          className={({ isActive }) => `header-nav-link${isActive ? ' active' : ''}`}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM16.5 10a3.5 3.5 0 1 0 0-7M2 20v-2a6.5 6.5 0 0 1 13 0v2H2ZM17 14a5 5 0 0 1 5 5v1h-4" />
          </svg>
          Chat
        </NavLink>
        <NavLink
          to="/app/profile"
          className={({ isActive }) => `header-nav-link${isActive ? ' active' : ''}`}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="7" r="4" />
            <path d="M4 21v-1.5a8 8 0 0 1 16 0V21H4Z" />
          </svg>
          Profile
        </NavLink>
      </nav>
      <div className="dashboard-top-actions">
        <GlobalSearch />
        <NotificationBell />
        <div className="header-account" ref={accountRoot}>
          <button
            type="button"
            className="header-account-toggle"
            aria-label={`Account menu for ${user.name}`}
            aria-expanded={accountOpen}
            aria-controls="header-account-menu"
            onClick={() => setAccountOpen((open) => !open)}
          >
            <span className="account-initial" aria-hidden="true">
              {avatarUrl ? <img src={mediaUrl(avatarUrl)} alt="" /> : initial}
            </span>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m5 9 7 7 7-7" />
            </svg>
          </button>
          {accountOpen && (
            <div
              className="header-account-menu"
              id="header-account-menu"
              role="group"
              aria-label="Account options"
            >
              <strong>{user.name}</strong>
              <Link to="/app/profile" onClick={() => setAccountOpen(false)}>
                View profile
              </Link>
              <Link to="/app/network" onClick={() => setAccountOpen(false)}>
                My Network
              </Link>
              <Link to="/app/settings" onClick={() => setAccountOpen(false)}>
                Settings
              </Link>
              <button
                type="button"
                disabled={signingOut}
                onClick={() => {
                  setAccountOpen(false);
                  onSignOut();
                }}
              >
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
