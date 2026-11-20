import { Link } from 'react-router';
const sections = [
  ['Account', 'Name, email, and account status', '/app/settings/account'],
  ['Security', 'Password and active sessions', '/app/settings/security'],
  ['Privacy', 'Profile, discovery, requests, and messages', '/app/settings/privacy'],
  ['Notifications', 'Choose your in-app alerts', '/app/notifications/settings'],
  ['Blocked users', 'Review and unblock members', '/app/settings/blocked-users'],
  ['Feed interests', 'Guide recommendations', '/app/settings/feed'],
  ['Your data', 'Download personal data and account deletion status', '/app/settings/data']
] as const;
export default function SettingsOverviewPage() {
  return (
    <div className="settings-page">
      <header>
        <h1>Settings</h1>
        <p>Manage your account, privacy, and professional experience.</p>
      </header>
      <div className="settings-grid">
        {sections.map(([title, description, href]) => (
          <Link key={href} to={href}>
            <h2>{title}</h2>
            <p>{description}</p>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
