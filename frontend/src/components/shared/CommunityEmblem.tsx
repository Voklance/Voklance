import type { CommunitySummary } from '@voklance/shared';
import SkillIcon from './SkillIcon';

const technologyNames: { pattern: RegExp; slug: string; tone: string }[] = [
  { pattern: /\breact\b/i, slug: 'react-js', tone: 'react' },
  { pattern: /\bjavascript\b|\bjava script\b/i, slug: 'javascript', tone: 'javascript' },
  { pattern: /\btypescript\b/i, slug: 'typescript', tone: 'technology' },
  { pattern: /\bnode(?:\.?js)?\b/i, slug: 'node-js', tone: 'technology' },
  { pattern: /\bpython\b/i, slug: 'python', tone: 'technology' },
  { pattern: /\bvue(?:\.?js)?\b/i, slug: 'vue-js', tone: 'technology' },
  { pattern: /\bangular\b/i, slug: 'angular', tone: 'technology' },
  { pattern: /\bdocker\b/i, slug: 'docker', tone: 'technology' },
  { pattern: /\bkubernetes\b/i, slug: 'kubernetes', tone: 'technology' }
];

export default function CommunityEmblem({ community }: { community: CommunitySummary }) {
  const technology = technologyNames.find(({ pattern }) => pattern.test(community.name));
  if (technology)
    return (
      <span className="community-aside-emblem" data-tone={technology.tone} aria-hidden="true">
        <SkillIcon skill={{ slug: technology.slug }} />
      </span>
    );

  const tone =
    community.category === 'cloud-devops'
      ? 'devops'
      : community.category === 'data-science-ai'
        ? 'ai'
        : community.category === 'software-development'
          ? 'systems'
          : 'community';
  return (
    <span className="community-aside-emblem" data-tone={tone} aria-hidden="true">
      {tone === 'devops' ? (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 12c-2.4-3.5-3.8-5-6.1-5a5 5 0 0 0 0 10c2.3 0 3.7-1.5 6.1-5Zm0 0c2.4-3.5 3.8-5 6.1-5a5 5 0 0 1 0 10c-2.3 0-3.7-1.5-6.1-5Z" />
        </svg>
      ) : tone === 'ai' ? (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 5a3 3 0 0 0-5.7-1.3A3.7 3.7 0 0 0 3.5 9a3.6 3.6 0 0 0 .5 6A3.5 3.5 0 0 0 7.5 20 3 3 0 0 0 12 18m0-13a3 3 0 0 1 5.7-1.3A3.7 3.7 0 0 1 20.5 9a3.6 3.6 0 0 1-.5 6 3.5 3.5 0 0 1-3.5 5A3 3 0 0 1 12 18M12 5v13M7 9l2 2-2 2m10-4-2 2 2 2" />
        </svg>
      ) : tone === 'systems' ? (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="9" cy="8" r="3" />
          <path d="M2.5 20v-2a6.5 6.5 0 0 1 13 0v2M17 5a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3.5 4.8V20" />
        </svg>
      )}
    </span>
  );
}
