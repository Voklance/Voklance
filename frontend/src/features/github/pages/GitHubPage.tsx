import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { apiErrorMessage } from '@/lib/apiClient';
import { githubApi } from '../api/githubApi';
import {
  githubKeys,
  useGitHubConnection,
  useGitHubFeatured,
  useGitHubRepositories
} from '../hooks/useGitHub';
export default function GitHubPage() {
  const client = useQueryClient();
  const connection = useGitHubConnection();
  const featured = useGitHubFeatured();
  const [search, setSearch] = useState('');
  const [language, setLanguage] = useState('');
  const [sort, setSort] = useState('recently_updated');
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const repositories = useGitHubRepositories(search, language, sort, !!connection.data?.connected);
  useEffect(() => {
    if (featured.data && !editing) setSelected(featured.data.repositories.map((repo) => repo.id));
  }, [featured.data, editing]);
  const refresh = () => {
    void client.invalidateQueries({ queryKey: githubKeys.root });
  };
  const connect = useMutation({
    mutationFn: githubApi.connect,
    onSuccess: ({ authorizationUrl }) => {
      const url = new URL(authorizationUrl);
      if (
        url.protocol === 'https:' &&
        url.hostname === 'github.com' &&
        url.pathname === '/login/oauth/authorize'
      )
        window.location.assign(authorizationUrl);
    }
  });
  const sync = useMutation({ mutationFn: githubApi.sync, onSuccess: refresh });
  const disconnect = useMutation({
    mutationFn: githubApi.disconnect,
    onSuccess: () => {
      setSelected([]);
      setEditing(false);
      refresh();
    }
  });
  const save = useMutation({
    mutationFn: githubApi.saveFeatured,
    onSuccess: () => {
      setEditing(false);
      refresh();
    }
  });
  const move = (id: string, direction: -1 | 1) => {
    const next = [...selected];
    const index = next.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setSelected(next);
    setEditing(true);
  };
  const toggle = (id: string) => {
    if (selected.includes(id)) setSelected(selected.filter((value) => value !== id));
    else if (selected.length < 6) setSelected([...selected, id]);
    setEditing(true);
  };
  return (
    <section className="github-page">
      <p className="network-eyebrow">Developer portfolio</p>
      <h1>GitHub projects</h1>
      <p>
        Connect your GitHub identity, import public repository metadata, and choose up to six featured
        projects. Voklance does not store your GitHub access token.
      </p>
      <Link to="/app/profile">Back to profile</Link>
      {connection.isPending ? (
        <p role="status">Loading GitHub connection…</p>
      ) : connection.isError ? (
        <p role="alert">{apiErrorMessage(connection.error)}</p>
      ) : !connection.data?.connected ? (
        <div className="github-empty">
          <p>No GitHub account connected.</p>
          <button
            type="button"
            className="community-primary"
            disabled={connect.isPending}
            onClick={() => connect.mutate()}
          >
            Connect GitHub
          </button>
          {connect.isError && <p role="alert">{apiErrorMessage(connect.error)}</p>}
        </div>
      ) : (
        <>
          <div className="github-connection">
            <strong>
              Connected as{' '}
              <a href={connection.data.profileUrl} target="_blank" rel="noopener noreferrer">
                {connection.data.username}
              </a>
            </strong>
            <p>
              Last sync:{' '}
              {connection.data.lastSyncedAt
                ? new Date(connection.data.lastSyncedAt).toLocaleString()
                : 'Never'}{' '}
              · {connection.data.syncStatus}
            </p>
            <button type="button" onClick={() => sync.mutate()} disabled={sync.isPending}>
              {sync.isPending ? 'Syncing…' : 'Sync public repositories'}
            </button>{' '}
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Disconnect GitHub and remove imported repository data?'))
                  disconnect.mutate();
              }}
              disabled={disconnect.isPending}
            >
              Disconnect
            </button>
            {sync.isError && <p role="alert">{apiErrorMessage(sync.error)}</p>}
            {disconnect.isError && <p role="alert">{apiErrorMessage(disconnect.error)}</p>}
            {sync.isSuccess && <p role="status">Imported {sync.data.importedCount} public repositories.</p>}
          </div>
          <div className="github-filters">
            <label>
              Search repositories
              <input value={search} onChange={(event) => setSearch(event.target.value)} maxLength={100} />
            </label>
            <label>
              Language
              <input value={language} onChange={(event) => setLanguage(event.target.value)} maxLength={100} />
            </label>
            <label>
              Sort
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="recently_updated">Recently updated</option>
                <option value="most_starred">Most starred</option>
                <option value="name">Name</option>
              </select>
            </label>
          </div>
          <h2>Featured projects ({selected.length}/6)</h2>
          <p>Select repositories below, then save the order shown here.</p>
          <ol className="github-featured-list">
            {selected.map((id, index) => {
              const repo =
                repositories.data?.pages.flatMap((page) => page.items).find((item) => item.id === id) ??
                featured.data?.repositories.find((item) => item.id === id);
              return (
                <li key={id}>
                  {repo?.name ?? 'Project'}{' '}
                  <button
                    type="button"
                    aria-label={`Move ${repo?.name ?? 'project'} up`}
                    disabled={index === 0}
                    onClick={() => move(id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${repo?.name ?? 'project'} down`}
                    disabled={index === selected.length - 1}
                    onClick={() => move(id, 1)}
                  >
                    ↓
                  </button>
                  <button type="button" onClick={() => toggle(id)}>
                    Remove
                  </button>
                </li>
              );
            })}
          </ol>
          <button
            type="button"
            className="community-primary"
            disabled={save.isPending || !editing}
            onClick={() => save.mutate(selected)}
          >
            Save featured projects
          </button>
          {save.isError && <p role="alert">{apiErrorMessage(save.error)}</p>}
          {save.isSuccess && <p role="status">Featured projects saved.</p>}
          <h2>Imported public repositories</h2>
          {repositories.isPending ? (
            <p role="status">Loading repositories…</p>
          ) : repositories.isError ? (
            <p role="alert">{apiErrorMessage(repositories.error)}</p>
          ) : repositories.data?.pages.flatMap((page) => page.items).length ? (
            <div className="github-repository-grid">
              {repositories.data.pages
                .flatMap((page) => page.items)
                .map((repo) => (
                  <article key={repo.id} className="github-repository-card">
                    <label>
                      <input
                        type="checkbox"
                        checked={selected.includes(repo.id)}
                        disabled={!selected.includes(repo.id) && selected.length >= 6}
                        onChange={() => toggle(repo.id)}
                      />{' '}
                      Feature {repo.name}
                    </label>
                    {repo.description && <p>{repo.description}</p>}
                    <p>
                      {repo.primaryLanguage ?? 'Language not listed'} · ★ {repo.stargazersCount} · Forks{' '}
                      {repo.forksCount}
                    </p>
                    <a href={repo.htmlUrl} target="_blank" rel="noopener noreferrer">
                      View repository
                    </a>
                  </article>
                ))}
            </div>
          ) : (
            <p>No public repositories imported yet. Sync to load them.</p>
          )}
          {repositories.hasNextPage && (
            <button
              type="button"
              onClick={() => void repositories.fetchNextPage()}
              disabled={repositories.isFetchingNextPage}
            >
              Load more
            </button>
          )}
        </>
      )}
    </section>
  );
}
