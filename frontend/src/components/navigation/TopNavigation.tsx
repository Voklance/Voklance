import type { AuthUser } from '@voklance/shared';
import { Link } from 'react-router';
import voklanceLogo from '@/assets/Voklanceimage.png';

export default function TopNavigation({ user }: { user: AuthUser }) {
  const initial = user.name.trim().charAt(0).toUpperCase();
  return (
    <header className="dashboard-topbar">
      <Link className="brand dashboard-brand" to="/app" aria-label="Voklance home">
        <img src={voklanceLogo} alt="Voklance" />
      </Link>
      <div className="dashboard-top-actions">
        <button className="top-control search-control" type="button" disabled title="Search is coming soon">
          Search Voklance <span>Coming soon</span>
        </button>
        <button
          className="top-control notification-control"
          type="button"
          disabled
          title="Notifications are coming soon"
        >
          Notifications <span>Coming soon</span>
        </button>
        <Link className="account-initial" to="/app/profile" aria-label={`View profile for ${user.name}`}>
          {initial}
        </Link>
      </div>
    </header>
  );
}
