import type { ProfileCertification, ProfileProject } from '@voklance/shared';
import type { CSSProperties } from 'react';
import ProfileSectionHeading from './ProfileSectionHeading';

function monthYear(date: string) {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
export function ProjectSection({
  items,
  style,
  owner = false
}: {
  items: ProfileProject[];
  style?: CSSProperties;
  owner?: boolean;
}) {
  return (
    <section className="profile-section" aria-labelledby="profile-projects" style={style}>
      <ProfileSectionHeading
        id="profile-projects"
        title="Featured Projects"
        kind="projects"
        editHref={owner ? '/app/profile/edit#profile-projects-editor' : undefined}
        actionKind="add"
        actionLabel="Add project"
      />
      {!items.length ? (
        <p>No projects listed yet.</p>
      ) : (
        <ul className="profile-timeline profile-project-list">
          {items.map((item) => (
            <li key={item.id}>
              <span className="profile-entry-mark profile-project-mark" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="m9 5-7 7 7 7m6-14 7 7-7 7m-2-17-2 20" />
                </svg>
              </span>
              <div className="profile-entry-copy">
                <strong>{item.title}</strong>
                {item.isFeatured && <span className="profile-featured-tag">Featured</span>}
                {item.role && <span>{item.role}</span>}
                <p>{item.description}</p>
                {item.technologies.length > 0 && (
                  <div className="profile-chips profile-project-tags">
                    {item.technologies.map((technology) => (
                      <span key={technology}>{technology}</span>
                    ))}
                  </div>
                )}
                {(item.startDate || item.endDate) && (
                  <small>
                    {item.startDate ? monthYear(item.startDate) : ''}
                    {item.endDate ? ` – ${monthYear(item.endDate)}` : item.isOngoing ? ' – Present' : ''}
                  </small>
                )}
                <div className="profile-project-links">
                  {item.projectUrl && (
                    <a
                      href={item.projectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Live project"
                    >
                      Live project ↗
                    </a>
                  )}
                  {item.repositoryUrl && (
                    <a href={item.repositoryUrl} target="_blank" rel="noopener noreferrer">
                      Repository ↗
                    </a>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function CertificationSection({
  items,
  style,
  owner = false
}: {
  items: ProfileCertification[];
  style?: CSSProperties;
  owner?: boolean;
}) {
  return (
    <section className="profile-section" aria-labelledby="profile-certifications" style={style}>
      <ProfileSectionHeading
        id="profile-certifications"
        title="Certifications"
        kind="certifications"
        editHref={owner ? '/app/profile/edit#profile-certifications-editor' : undefined}
        actionKind="add"
        actionLabel="Add certification"
      />
      {!items.length ? (
        <p>No certifications listed yet.</p>
      ) : (
        <ul className="profile-timeline profile-certification-list">
          {items.map((item) => (
            <li key={item.id}>
              <span className="profile-entry-mark profile-certificate-mark" aria-hidden="true">
                ✦
              </span>
              <div className="profile-entry-copy">
                <strong>{item.name}</strong>
                <span>
                  {item.issuingOrganization} · {monthYear(item.issueDate)}
                </span>
                {item.expirationDate && <small>Expires {monthYear(item.expirationDate)}</small>}
                {item.credentialId && <small>Credential ID: {item.credentialId}</small>}
                {item.credentialUrl && (
                  <a href={item.credentialUrl} target="_blank" rel="noopener noreferrer">
                    View credential ↗
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
