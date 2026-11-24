import { PROFILE_SECTION_IDS } from '@voklance/shared';
import type {
  CatalogItem,
  Education,
  ProfessionalExperience,
  ProfessionalProfile,
  ProfileCertification,
  ProfileProject,
  ProfileRatingSummary,
  ProfileSectionId
} from '@voklance/shared';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import GitHubPortfolioPanel from '@/features/github/components/GitHubPortfolioPanel';
import { mediaUrl } from '@/lib/mediaUrl';
import { CertificationSection, ProjectSection } from './PortfolioSections';
import ProfileCoverEditor from './ProfileCoverEditor';
import { RatingDisplay } from './ProfileRating';
import ProfileSectionHeading from './ProfileSectionHeading';

function displayStatus(status?: string) {
  return status
    ?.replaceAll('_', ' ')
    .toLowerCase()
    .replace(/^./, (character) => character.toUpperCase());
}
function monthYear(date: string) {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
function experienceLength(items: ProfessionalExperience[]) {
  const now = Date.now();
  const periods = items
    .map((item) => ({
      start: Date.parse(item.startDate),
      end: item.isCurrent || !item.endDate ? now : Date.parse(item.endDate)
    }))
    .filter(({ start, end }) => Number.isFinite(start) && Number.isFinite(end) && start <= now)
    .sort((a, b) => a.start - b.start);
  if (!periods.length) return '';
  let total = 0;
  let { start, end } = periods[0];
  for (const period of periods.slice(1)) {
    if (period.start <= end) end = Math.max(end, period.end);
    else {
      total += end - start;
      ({ start, end } = period);
    }
  }
  total += end - start;
  const months = Math.max(1, Math.floor(total / (1000 * 60 * 60 * 24 * 30.44)));
  return months < 12 ? `${months}+ months of experience` : `${Math.floor(months / 12)}+ years of experience`;
}
function LocationIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 2v6m10-6v6M3 10h18" />
    </svg>
  );
}

export default function ProfileDetails({
  profile,
  skills,
  interests,
  experiences,
  education,
  certifications = [],
  projects = [],
  rating,
  owner = false,
  actions
}: {
  profile: Omit<ProfessionalProfile, 'id'>;
  skills: CatalogItem[];
  interests?: CatalogItem[];
  experiences: ProfessionalExperience[];
  education: Education[];
  certifications?: ProfileCertification[];
  projects?: ProfileProject[];
  rating?: ProfileRatingSummary;
  owner?: boolean;
  actions?: ReactNode;
}) {
  const [shareNotice, setShareNotice] = useState('');
  const initial = profile.fullName.trim().charAt(0).toUpperCase();
  const location = [profile.city, profile.country].filter(Boolean).join(', ');
  const tenure = experienceLength(experiences);
  const links = [
    ['GitHub', profile.githubUrl],
    ['Portfolio', profile.portfolioUrl],
    ['Website', profile.websiteUrl]
  ] as const;
  const referenceOrder: ProfileSectionId[] = [
    'about',
    'experience',
    'projects',
    'education',
    'certifications',
    'links',
    'skills',
    'github'
  ];
  const arranged = profile.sectionOrder?.some((section, index) => section !== PROFILE_SECTION_IDS[index])
    ? profile.sectionOrder
    : referenceOrder;
  const order = (section: ProfileSectionId) => {
    const index = arranged.indexOf(section);
    return { order: index >= 0 ? index : referenceOrder.indexOf(section) };
  };
  async function share() {
    const url = `${window.location.origin}/u/${profile.username}`;
    try {
      if (navigator.share) await navigator.share({ title: profile.fullName, url });
      else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setShareNotice('Profile link copied.');
      } else setShareNotice('Sharing is unavailable.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setShareNotice('Could not share profile.');
    }
  }
  return (
    <article className="professional-profile">
      <header className="profile-hero">
        <div
          className={`profile-cover${profile.coverUrl ? ' has-image' : ''}`}
          style={profile.coverUrl ? { backgroundImage: `url("${mediaUrl(profile.coverUrl)}")` } : undefined}
        >
          {!profile.coverUrl && (
            <svg
              className="profile-cover-art"
              viewBox="0 0 1000 180"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="profile-sky" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#8bd8fa" />
                  <stop offset=".52" stopColor="#8ab9fb" />
                  <stop offset="1" stopColor="#b5d6ff" />
                </linearGradient>
                <linearGradient id="profile-wave" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#2b87f6" />
                  <stop offset="1" stopColor="#1264ed" />
                </linearGradient>
              </defs>
              <rect width="1000" height="180" fill="url(#profile-sky)" />
              <path
                d="M410 180C560 176 590 124 682 25c8-9 16-17 24-25h129C716 30 688 129 600 180Z"
                fill="url(#profile-wave)"
              />
              <path d="M610 180C712 148 742 61 861 0h139v180Z" fill="#8fc5ff" opacity=".74" />
            </svg>
          )}
          {owner && <ProfileCoverEditor hasCover={!!profile.coverUrl} />}
        </div>
        <div className="profile-identity">
          <div className="profile-avatar" role="img" aria-label={`${profile.fullName} avatar`}>
            {profile.avatarUrl ? <img src={mediaUrl(profile.avatarUrl)} alt="" /> : initial}
          </div>
          <div className="profile-identity-copy">
            <div className="profile-identity-top">
              <div>
                <h1>{profile.fullName}</h1>
                <p className="profile-headline">{profile.headline}</p>
              </div>
            </div>
            <div className="profile-meta-row">
              {location && (
                <span>
                  <LocationIcon />
                  {location}
                </span>
              )}
              {tenure && (
                <span>
                  <CalendarIcon />
                  {tenure}
                </span>
              )}
              {profile.professionalStatus && <span>{displayStatus(profile.professionalStatus)}</span>}
            </div>
            {skills.length > 0 && (
              <div className="profile-hero-skills">
                {skills.slice(0, 4).map((item) => (
                  <span key={item.id}>{item.name}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="profile-summary">
          <p className="profile-hero-bio">
            {profile.bio ||
              (owner
                ? 'Add a short introduction to tell your professional story.'
                : 'No introduction provided.')}
          </p>
          <div className="profile-summary-footer">
            <div className="profile-hero-actions">
              {owner && (
                <Link className="profile-primary-action" to="/app/profile/edit">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="m4 20 4.5-1 11-11a2 2 0 0 0-3-3l-11 11L4 20ZM14.5 7.5l3 3" />
                  </svg>
                  Edit profile
                </Link>
              )}
              {actions}
              {(!owner || profile.visibility === 'PUBLIC') && (
                <button type="button" className="profile-share-button" onClick={() => void share()}>
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="18" cy="5" r="2.5" />
                    <circle cx="6" cy="12" r="2.5" />
                    <circle cx="18" cy="19" r="2.5" />
                    <path d="m8.3 10.8 7.4-4.6m-7.4 7 7.4 4.6" />
                  </svg>
                  Share
                </button>
              )}
              {owner && (
                <details className="profile-more-menu">
                  <summary aria-label="More profile actions">···</summary>
                  <div>
                    {profile.visibility === 'PUBLIC' && (
                      <Link to={`/u/${profile.username}`}>View as visitor</Link>
                    )}
                    <Link to="/app/settings">Profile settings</Link>
                    <Link to="/app/profile/edit">Edit details</Link>
                  </div>
                </details>
              )}
            </div>
            <RatingDisplay rating={rating} />
          </div>
          {shareNotice && (
            <p className="profile-share-notice" role="status">
              {shareNotice}
            </p>
          )}
        </div>
      </header>
      <div className="profile-sections">
        <div className="profile-main-column">
          <section
            className="profile-section"
            aria-labelledby="profile-experience"
            style={order('experience')}
          >
            <ProfileSectionHeading
              id="profile-experience"
              title="Experience"
              kind="experience"
              editHref={owner ? '/app/profile/edit#edit-history' : undefined}
              actionKind="add"
              actionLabel="Add experience"
            />
            {experiences.length ? (
              <ul className="profile-timeline profile-experience-list">
                {experiences.map((item) => (
                  <li key={item.id}>
                    <span className="profile-entry-mark" aria-hidden="true">
                      {item.companyName.trim().charAt(0).toUpperCase()}
                    </span>
                    <div className="profile-entry-copy">
                      <strong>{item.jobTitle}</strong>
                      <span>
                        {item.companyName}
                        {item.employmentType ? ` · ${item.employmentType}` : ''}
                      </span>
                      <small>
                        <CalendarIcon />
                        {monthYear(item.startDate)} –{' '}
                        {item.isCurrent ? 'Present' : monthYear(item.endDate || item.startDate)}
                      </small>
                      {item.description && <p>{item.description}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No experience listed yet.</p>
            )}
          </section>
          <ProjectSection items={projects} style={order('projects')} owner={owner} />
          <section className="profile-section" aria-labelledby="profile-education" style={order('education')}>
            <ProfileSectionHeading
              id="profile-education"
              title="Education"
              kind="education"
              editHref={owner ? '/app/profile/edit#edit-history' : undefined}
              actionKind="add"
              actionLabel="Add education"
            />
            {education.length ? (
              <ul className="profile-timeline profile-education-list">
                {education.map((item) => (
                  <li key={item.id}>
                    <span className="profile-entry-mark profile-school-mark" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="m2 9 10-6 10 6M4 10h16M5 20h14M7 11v8m5-8v8m5-8v8M2 22h20" />
                      </svg>
                    </span>
                    <div className="profile-entry-copy">
                      <strong>{item.institution}</strong>
                      {(item.degree || item.fieldOfStudy) && (
                        <span>{[item.degree, item.fieldOfStudy].filter(Boolean).join(', ')}</span>
                      )}
                      <small>
                        <CalendarIcon />
                        {monthYear(item.startDate)} – {item.endDate ? monthYear(item.endDate) : 'Present'}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No education listed yet.</p>
            )}
          </section>
          <CertificationSection items={certifications} style={order('certifications')} owner={owner} />
          <GitHubPortfolioPanel username={profile.username} own={owner} style={order('github')} />
        </div>
        <div className="profile-side-column">
          <section className="profile-section" aria-labelledby="profile-links" style={order('links')}>
            <ProfileSectionHeading
              id="profile-links"
              title="Professional Links"
              kind="links"
              editHref={owner ? '/app/profile/edit' : undefined}
            />
            {links.some(([, url]) => !!url) ? (
              <ul className="profile-links">
                {links.map(
                  ([label, url]) =>
                    url && (
                      <li key={label}>
                        <span className="profile-link-mark" aria-hidden="true">
                          {label === 'GitHub' ? (
                            <svg viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="9" />
                              <path d="M9 19v-3c-3 0-4-2-4-3m10 6v-3c3 0 4-2 4-3M9 16c-2-1-2-5-1-6l-1-3 3 1a8 8 0 0 1 4 0l3-1-1 3c1 1 1 5-1 6" />
                            </svg>
                          ) : label === 'Portfolio' ? (
                            <svg viewBox="0 0 24 24" fill="none">
                              <rect x="3" y="4" width="18" height="16" rx="2" />
                              <path d="m10 9-3 3 3 3m4-6 3 3-3 3" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="9" />
                              <path d="M3 12h18M12 3c3 3 4.5 6 4.5 9S15 18 12 21M12 3c-3 3-4.5 6-4.5 9s1.5 6 4.5 9" />
                            </svg>
                          )}
                        </span>
                        <a href={url} aria-label={label} target="_blank" rel="noopener noreferrer">
                          {url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                        </a>
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M13 5h6v6m0-6-9 9M19 13v6H5V5h6" />
                        </svg>
                      </li>
                    )
                )}
              </ul>
            ) : (
              <p>No professional links listed yet.</p>
            )}
          </section>
          <section className="profile-section" aria-labelledby="profile-skills" style={order('skills')}>
            <ProfileSectionHeading
              id="profile-skills"
              title="Skills"
              kind="skills"
              editHref={owner ? '/app/profile/edit' : undefined}
            />
            {skills.length ? (
              <div className="profile-chips profile-skills-grid">
                {skills.map((item) => (
                  <span key={item.id}>{item.name}</span>
                ))}
              </div>
            ) : (
              <p>No skills listed yet.</p>
            )}
          </section>
          {interests && interests.length > 0 && (
            <section className="profile-section" aria-labelledby="profile-interests">
              <ProfileSectionHeading id="profile-interests" title="Interests" kind="about" />
              <div className="profile-chips profile-interests-grid">
                {interests.map((item) => (
                  <span key={item.id}>{item.name}</span>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </article>
  );
}
