import { Link } from 'react-router';
import type { ProfileSectionId } from '@voklance/shared';

export function ProfileSectionIcon({ kind }: { kind: ProfileSectionId }) {
  const paths: Record<ProfileSectionId, React.ReactNode> = {
    about: (
      <>
        <circle cx="12" cy="7" r="3.4" />
        <path d="M5 21v-1.5a7 7 0 0 1 14 0V21H5ZM7 3.5h10" />
      </>
    ),
    experience: (
      <>
        <rect x="3" y="7" width="18" height="14" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" />
      </>
    ),
    projects: (
      <>
        <path d="m12 2 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 15l9 5 9-5" />
      </>
    ),
    education: (
      <>
        <path d="m2 9 10-5 10 5-10 5L2 9Zm4 3v5c3.5 3 8.5 3 12 0v-5M22 9v7" />
      </>
    ),
    certifications: (
      <>
        <circle cx="12" cy="9" r="6" />
        <path d="m9 14-2 7 5-2 5 2-2-7m-5-5 1.5 1.5L15 7" />
      </>
    ),
    skills: (
      <>
        <path d="m9 4-7 8 7 8m6-16 7 8-7 8M13 2l-2 20" />
      </>
    ),
    links: (
      <>
        <path d="M10 14a5 5 0 0 0 7.1 0l2.2-2.2a5 5 0 0 0-7.1-7.1l-1.3 1.3M14 10a5 5 0 0 0-7.1 0l-2.2 2.2a5 5 0 0 0 7.1 7.1l1.3-1.3" />
      </>
    ),
    github: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 19v-3c-3 0-4-2-4-3m10 6v-3c3 0 4-2 4-3M9 16c-2-1-2-5-1-6l-1-3 3 1a8 8 0 0 1 4 0l3-1-1 3c1 1 1 5-1 6" />
      </>
    )
  };
  return (
    <svg className="profile-section-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {paths[kind]}
    </svg>
  );
}

export default function ProfileSectionHeading({
  id,
  title,
  kind,
  editHref,
  actionKind = 'edit',
  actionLabel
}: {
  id: string;
  title: string;
  kind: ProfileSectionId;
  editHref?: string;
  actionKind?: 'edit' | 'add';
  actionLabel?: string;
}) {
  const label = actionLabel ?? `${actionKind === 'add' ? 'Add to' : 'Edit'} ${title}`;
  return (
    <div className="profile-section-heading">
      <div>
        <ProfileSectionIcon kind={kind} />
        <h2 id={id}>{title}</h2>
      </div>
      {editHref && (
        <Link
          className={`profile-section-edit${actionKind === 'add' ? ' profile-section-add' : ''}`}
          to={editHref}
          aria-label={label}
          title={label}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            {actionKind === 'add' ? (
              <path d="M12 5v14M5 12h14" />
            ) : (
              <path d="m4 20 4.5-1 11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20ZM14.5 7.5l3 3" />
            )}
          </svg>
        </Link>
      )}
    </div>
  );
}
