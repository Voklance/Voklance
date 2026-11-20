import type { ProfileCertification, ProfileProject } from '@voklance/shared';
import type { CSSProperties } from 'react';
export function ProjectSection({ items, style }: { items: ProfileProject[]; style?: CSSProperties }) {
  return (
    <section className="profile-section" aria-labelledby="profile-projects" style={style}>
      <h2 id="profile-projects">Projects</h2>
      {!items.length ? (
        <p>No projects listed yet.</p>
      ) : (
        <ul className="profile-timeline">
          {items.map((item) => (
            <li key={item.id}>
              {item.isFeatured && <span className="command-activity-type">Featured</span>}
              <strong>{item.title}</strong>
              {item.role && <span>{item.role}</span>}
              <p>{item.description}</p>
              {item.technologies.length > 0 && <p>{item.technologies.join(' · ')}</p>}
              {(item.startDate || item.endDate) && (
                <small>
                  {item.startDate ?? ''}
                  {item.endDate ? ` – ${item.endDate}` : item.isOngoing ? ' – Present' : ''}
                </small>
              )}
              <div className="profile-links">
                {item.projectUrl && (
                  <a href={item.projectUrl} target="_blank" rel="noopener noreferrer">
                    Live project
                  </a>
                )}
                {item.repositoryUrl && (
                  <a href={item.repositoryUrl} target="_blank" rel="noopener noreferrer">
                    Repository
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
export function CertificationSection({
  items,
  style
}: {
  items: ProfileCertification[];
  style?: CSSProperties;
}) {
  return (
    <section className="profile-section" aria-labelledby="profile-certifications" style={style}>
      <h2 id="profile-certifications">Certifications</h2>
      {!items.length ? (
        <p>No certifications listed yet.</p>
      ) : (
        <ul className="profile-timeline">
          {items.map((item) => (
            <li key={item.id}>
              <strong>{item.name}</strong>
              <span>{item.issuingOrganization}</span>
              <small>
                Issued {item.issueDate}
                {item.expirationDate ? ` · Expires ${item.expirationDate}` : ''}
              </small>
              {item.credentialId && <p>Credential ID: {item.credentialId}</p>}
              {item.credentialUrl && (
                <a href={item.credentialUrl} target="_blank" rel="noopener noreferrer">
                  View credential
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
