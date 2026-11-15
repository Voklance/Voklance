import { NavLink } from 'react-router';

interface SideNavigationProps {
  onSignOut: () => void;
  signingOut: boolean;
}

export default function SideNavigation({ onSignOut, signingOut }: SideNavigationProps) {
  return (
    <nav className="dashboard-sidebar" aria-label="Main navigation">
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
        <NavLink to="/app/referrals" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          My referrals
        </NavLink>
        <span className="sidebar-link unavailable">
          Events <small>Later</small>
        </span>
        <NavLink to="/app/saved" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          Saved posts
        </NavLink>
      </div>
      <button className="signout-link" type="button" onClick={onSignOut} disabled={signingOut}>
        {signingOut ? 'Signing out…' : 'Sign out'}
      </button>
    </nav>
  );
}
