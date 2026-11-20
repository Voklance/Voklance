import type { AuthUser } from '@voklance/shared';
import { Link } from 'react-router';
import voklanceLogo from '@/assets/Voklanceimage.png';
import NotificationBell from '@/features/notifications/components/NotificationBell';
import GlobalSearch from '@/features/search/components/GlobalSearch';

export default function TopNavigation({
  user,
  menuOpen,
  onMenuToggle
}: {
  user: AuthUser;
  menuOpen: boolean;
  onMenuToggle: () => void;
}) {
  const initial = user.name.trim().charAt(0).toUpperCase();
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
      <div className="dashboard-top-actions">
        <GlobalSearch />
        <NotificationBell />
        <Link className="account-initial" to="/app/profile" aria-label={`View profile for ${user.name}`}>
          {initial}
        </Link>
      </div>
    </header>
  );
}
