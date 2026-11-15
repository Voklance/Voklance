import { Link, Outlet } from 'react-router';
import type { ReactNode } from 'react';
import voklanceLogo from '@/assets/Voklanceimage.png';

export default function AuthLayout({ children }: { children?: ReactNode }) {
  return (
    <div className="auth-layout">
      <aside className="brand-panel">
        <Link className="brand" to="/login" aria-label="Voklance home">
          <img src={voklanceLogo} alt="Voklance" />
        </Link>
        <div className="brand-statement">
          <h1>Professional networking, centered on communities.</h1>
          <p>
            Build your identity, share knowledge, and find opportunities through purposeful community
            participation.
          </p>
        </div>
        <div className="brand-footer" aria-label="Voklance focus areas">
          <span>Professional identity</span>
          <span>Relevant content</span>
          <span>Community action</span>
        </div>
      </aside>
      <main className="form-panel">
        <div className="form-content">{children ?? <Outlet />}</div>
      </main>
    </div>
  );
}
