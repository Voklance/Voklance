import { PROFILE_SECTION_IDS } from '@voklance/shared';
import type {
  CatalogItem,
  Education,
  ProfessionalExperience,
  ProfessionalProfile,
  ProfileCertification,
  ProfileProject,
  ProfileSectionId
} from '@voklance/shared';
import { Link } from 'react-router';
import { CertificationSection, ProjectSection } from './PortfolioSections';
import GitHubPortfolioPanel from '@/features/github/components/GitHubPortfolioPanel';

function displayStatus(status?: string) {
  return status
    ?.replaceAll('_', ' ')
    .toLowerCase()
    .replace(/^./, (character) => character.toUpperCase());
}

export default function ProfileDetails({
  profile,
  skills,
  interests,
  experiences,
  education,
  certifications = [],
  projects = [],
  owner = false
}: {
  profile: Omit<ProfessionalProfile, 'id'>;
  skills: CatalogItem[];
  interests?: CatalogItem[];
  experiences: ProfessionalExperience[];
  education: Education[];
  certifications?: ProfileCertification[];
  projects?: ProfileProject[];
  owner?: boolean;
}) {
  const initial = profile.fullName.trim().charAt(0).toUpperCase();
  const links = [
    ['GitHub', profile.githubUrl],
    ['Portfolio', profile.portfolioUrl],
    ['Website', profile.websiteUrl]
  ] as const;
  const order = (section: ProfileSectionId) => {
    const index = profile.sectionOrder?.indexOf(section) ?? -1;
    return { order: index >= 0 ? index : PROFILE_SECTION_IDS.indexOf(section) };
  };
  return (
    <article className="professional-profile">
      <header className="profile-hero">
        <div className="profile-cover" aria-hidden="true" />
        <div className="profile-identity">
          <div className="profile-avatar" role="img" aria-label={`${profile.fullName} avatar`}>
            {initial}
          </div>
          <div className="profile-identity-copy">
            <p className="profile-username">@{profile.username}</p>
            <h1>{profile.fullName}</h1>
            <p className="profile-headline">{profile.headline}</p>
            <p className="profile-meta">{[profile.city, profile.country].filter(Boolean).join(', ')}</p>
            {profile.professionalStatus && (
              <p className="profile-status">{displayStatus(profile.professionalStatus)}</p>
            )}
          </div>
          {owner && (
            <Link className="profile-primary-action" to="/app/profile/edit">
              Edit profile
            </Link>
          )}
        </div>
      </header>
      <div className="profile-sections">
        <section className="profile-section" aria-labelledby="profile-about" style={order('about')}>
          <h2 id="profile-about">About</h2>
          <p>
            {profile.bio ||
              (owner
                ? 'Add a short introduction to tell your professional story.'
                : 'No introduction provided.')}
          </p>
          {interests && interests.length > 0 && (
            <div className="profile-subsection">
              <h3>Interests</h3>
              <div className="profile-chips">
                {interests.map((item) => (
                  <span key={item.id}>{item.name}</span>
                ))}
              </div>
            </div>
          )}
        </section>
        <section className="profile-section" aria-labelledby="profile-experience" style={order('experience')}>
          <h2 id="profile-experience">Experience</h2>
          {experiences.length ? (
            <ul className="profile-timeline">
              {experiences.map((item) => (
                <li key={item.id}>
                  <strong>{item.jobTitle}</strong>
                  <span>
                    {item.companyName}
                    {item.employmentType ? `, ${item.employmentType}` : ''}
                  </span>
                  <small>
                    {item.startDate} – {item.isCurrent ? 'Present' : item.endDate || 'Present'}
                  </small>
                  {item.description && <p>{item.description}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p>No experience listed yet.</p>
          )}
        </section>
        <section className="profile-section" aria-labelledby="profile-education" style={order('education')}>
          <h2 id="profile-education">Education</h2>
          {education.length ? (
            <ul className="profile-timeline">
              {education.map((item) => (
                <li key={item.id}>
                  <strong>{item.institution}</strong>
                  {(item.degree || item.fieldOfStudy) && (
                    <span>{[item.degree, item.fieldOfStudy].filter(Boolean).join(', ')}</span>
                  )}
                  <small>
                    {item.startDate} – {item.endDate || 'Present'}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p>No education listed yet.</p>
          )}
        </section>
        <section className="profile-section" aria-labelledby="profile-skills" style={order('skills')}>
          <h2 id="profile-skills">Skills</h2>
          {skills.length ? (
            <div className="profile-chips">
              {skills.map((item) => (
                <span key={item.id}>{item.name}</span>
              ))}
            </div>
          ) : (
            <p>No skills listed yet.</p>
          )}
        </section>
        <ProjectSection items={projects} style={order('projects')} />
        <CertificationSection items={certifications} style={order('certifications')} />
        <GitHubPortfolioPanel username={profile.username} own={owner} style={order('github')} />
        <section className="profile-section" aria-labelledby="profile-links" style={order('links')}>
          <h2 id="profile-links">Professional links</h2>
          {links.some(([, url]) => !!url) ? (
            <ul className="profile-links">
              {links.map(
                ([label, url]) =>
                  url && (
                    <li key={label}>
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        {label}
                      </a>
                    </li>
                  )
              )}
            </ul>
          ) : (
            <p>No professional links listed yet.</p>
          )}
        </section>
      </div>
    </article>
  );
}
