import { useGitHubFeatured, useGitHubPortfolio } from '../hooks/useGitHub';
import type { CSSProperties } from 'react';
export default function GitHubPortfolioPanel({
  username,
  own = false,
  style
}: {
  username: string;
  own?: boolean;
  style?: CSSProperties;
}) {
  const publicQuery = useGitHubPortfolio(username, !own);
  const ownQuery = useGitHubFeatured(own);
  const portfolio = own ? ownQuery.data : publicQuery.data;
  if (!portfolio?.connected || !portfolio.repositories.length) return null;
  return (
    <section className="github-portfolio profile-section" style={style} aria-label="GitHub portfolio">
      <header>
        <h2>Featured GitHub projects</h2>
        {portfolio.profileUrl && (
          <a href={portfolio.profileUrl} target="_blank" rel="noopener noreferrer">
            View GitHub profile
          </a>
        )}
      </header>
      <div className="github-repository-grid">
        {portfolio.repositories.map((repo) => (
          <article key={repo.id} className="github-repository-card">
            <h3>
              <a href={repo.htmlUrl} target="_blank" rel="noopener noreferrer">
                {repo.name}
              </a>
            </h3>
            {repo.description && <p>{repo.description}</p>}
            <p>
              {repo.primaryLanguage ?? 'Language not listed'} · ★ {repo.stargazersCount} · Forks{' '}
              {repo.forksCount}
            </p>
            {repo.topics.length > 0 && <p className="github-topics">{repo.topics.slice(0, 5).join(' · ')}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
