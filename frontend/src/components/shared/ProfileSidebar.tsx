import type { AuthUser, ProfessionalExperience } from '@voklance/shared';
import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import {
  useMyExperiences,
  useMyProfile,
  useMyRating,
  useMySkills
} from '@/features/profiles/hooks/useProfileData';
import { RatingDisplay } from '@/features/profiles/components/ProfileRating';
import { useMyCommunities } from '@/features/communities/hooks/useCommunities';
import SkillIcon from './SkillIcon';
import CommunityEmblem from './CommunityEmblem';
import CommunityChatWidget from '@/features/communities/components/CommunityChatWidget';
import { mediaUrl } from '@/lib/mediaUrl';

function experienceLength(experiences: ProfessionalExperience[]) {
  const today = Date.now();
  const periods = experiences
    .map((item) => ({
      start: Date.parse(item.startDate),
      end: item.isCurrent || !item.endDate ? today : Date.parse(item.endDate)
    }))
    .filter(({ start, end }) => Number.isFinite(start) && Number.isFinite(end) && start <= today)
    .map(({ start, end }) => ({ start, end: Math.max(start, Math.min(end, today)) }))
    .sort((a, b) => a.start - b.start);
  if (!periods.length) return null;
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
  const months = Math.floor(total / (1000 * 60 * 60 * 24 * 30.44));
  if (months < 12) return `${Math.max(1, months)}+ Months Experience`;
  return `${(Math.floor((months / 12) * 10) / 10).toFixed(1)}+ Years Experience`;
}

export default function ProfileSidebar({ user }: { user: AuthUser }) {
  const [skillsExpanded, setSkillsExpanded] = useState(false);
  const [chatSlug, setChatSlug] = useState<string | null>(null);
  const closeChat = useCallback(() => setChatSlug(null), []);
  const profile = useMyProfile();
  const skills = useMySkills();
  const rating = useMyRating();
  const experiences = useMyExperiences();
  const communities = useMyCommunities();
  const joined = communities.data?.pages.flatMap((page) => page.items).slice(0, 5) ?? [];
  const person = profile.data?.profile;
  const name = person?.fullName ?? user.name;
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
  const primaryExperience =
    experiences.data?.experiences.find((item) => item.isCurrent) ?? experiences.data?.experiences[0];
  const experience = experienceLength(experiences.data?.experiences ?? []);
  const allSkills = skills.data?.skills ?? [];
  const shownSkills = skillsExpanded ? allSkills : allSkills.slice(0, 8);
  const remainingSkills = Math.max(0, allSkills.length - 8);

  return (
    <aside
      className={`dashboard-aside${chatSlug ? ' dashboard-aside--chat' : ''}`}
      aria-label={chatSlug ? 'Community chat' : 'Your account and communities'}
    >
      {chatSlug ? (
        <CommunityChatWidget key={chatSlug} slug={chatSlug} onClose={closeChat} />
      ) : (
        <>
          <section className="profile-aside-card" aria-label="Your profile summary">
            <div className="profile-aside-cover" aria-hidden="true">
              <svg viewBox="0 0 400 150" preserveAspectRatio="none">
                <path d="M0 77C78 112 132 94 205 60c67-31 134-42 195-30v120H0Z" />
                <path d="M0 108c93 25 173 6 238-32 59-34 105-45 162-44v118H0Z" />
              </svg>
            </div>
            <div className="profile-aside-identity">
              <Link
                className="profile-aside-avatar"
                to="/app/profile"
                aria-label={`View profile for ${name}`}
              >
                {person?.avatarUrl ? <img src={mediaUrl(person.avatarUrl)} alt="" /> : initials}
              </Link>
              <div className="profile-aside-person">
                <strong>{name}</strong>
                {person?.headline && <span className="profile-aside-headline">{person.headline}</span>}
                {primaryExperience && (
                  <>
                    <span className="profile-aside-meta">
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M3 21V5h12v16M15 10h6v11M7 9h4M7 13h4M7 17h4M18 14h1M18 17h1M2 21h20" />
                      </svg>
                      {primaryExperience.companyName}
                    </span>
                    <span className="profile-aside-meta">
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <rect x="2.5" y="7" width="19" height="14" rx="2" />
                        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M2.5 12h19" />
                      </svg>
                      {experience ?? primaryExperience.jobTitle}
                    </span>
                  </>
                )}
              </div>
            </div>
            {profile.isPending && (
              <p className="profile-aside-feedback" role="status">
                Loading profile…
              </p>
            )}
            {profile.isError && (
              <p className="profile-aside-feedback">Profile details are temporarily unavailable.</p>
            )}
            <div className="profile-aside-skills-heading">
              <h2>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="m8 6-6 6 6 6M16 6l6 6-6 6M14 3l-4 18" />
                </svg>
                Skills
              </h2>
              <Link to="/app/profile/edit" aria-label="Edit skills">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="m4 20 4.1-.9L19 8.2 15.8 5 4.9 15.9 4 20ZM13.8 7l3.2 3.2" />
                </svg>
              </Link>
            </div>
            {shownSkills.length ? (
              <ul className="profile-aside-skills">
                {shownSkills.map((skill) => (
                  <li key={skill.id}>
                    <span className="profile-aside-skill-mark">
                      <SkillIcon skill={skill} />
                    </span>
                    <span>{skill.name}</span>
                  </li>
                ))}
                {remainingSkills > 0 && (
                  <li className="profile-aside-more-skills">
                    <button
                      type="button"
                      aria-expanded={skillsExpanded}
                      onClick={() => setSkillsExpanded((expanded) => !expanded)}
                    >
                      {skillsExpanded ? 'Show less' : `+${remainingSkills}`}
                    </button>
                  </li>
                )}
              </ul>
            ) : (
              <p className="profile-aside-empty-skills">
                {skills.isPending ? 'Loading skills…' : 'Add skills to show what you do best.'}
              </p>
            )}
            <div className="profile-aside-footer">
              <RatingDisplay rating={rating.data} />
            </div>
          </section>
          <section className="profile-aside-communities" aria-label="Your communities">
            <div className="community-aside-heading">
              <h2>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="9" cy="7" r="3" />
                  <path d="M2 20v-2a7 7 0 0 1 14 0v2M17 5a3 3 0 0 1 0 6m1 3a5 5 0 0 1 4 5v1" />
                </svg>
                Your Communities
              </h2>
              <Link className="community-aside-join" to="/app/communities">
                <span aria-hidden="true">+</span> Join
              </Link>
            </div>
            {communities.isPending ? (
              <p className="community-aside-state" role="status">
                Loading communities…
              </p>
            ) : communities.isError ? (
              <p className="community-aside-state">Communities are temporarily unavailable.</p>
            ) : joined.length === 0 ? (
              <p className="community-aside-state">You have not joined a community yet. Find one to join.</p>
            ) : (
              <ul className="community-aside-list">
                {joined.map((community) => (
                  <li key={community.id}>
                    <button
                      type="button"
                      className="community-aside-item"
                      aria-label={`Open ${community.name} chat`}
                      aria-expanded={chatSlug === community.slug}
                      aria-controls={chatSlug === community.slug ? 'community-chat-widget' : undefined}
                      onClick={() => {
                        setChatSlug((current) => (current === community.slug ? null : community.slug));
                      }}
                    >
                      <CommunityEmblem community={community} />
                      <span className="community-aside-info">
                        <strong>{community.name}</strong>
                        <small>
                          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <circle cx="9" cy="8" r="2.5" />
                            <path d="M2.5 19a6.5 6.5 0 0 1 13 0M17 6a2.5 2.5 0 0 1 0 5m.5 3a5 5 0 0 1 4 5" />
                          </svg>
                          {community.memberCount.toLocaleString()}{' '}
                          {community.memberCount === 1 ? 'member' : 'members'}
                        </small>
                      </span>
                      <svg
                        className="community-aside-chevron"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path d="m9 5 7 7-7 7" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </aside>
  );
}
