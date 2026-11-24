import {
  COMMAND_IDS,
  COMMAND_LABELS,
  type CommandId,
  type CommandMetadata,
  type CommunityDetail
} from '@voklance/shared';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { apiErrorMessage } from '@/lib/apiClient';
import { useCommunityActivities, useCommunityCommands } from '../hooks/useCommunityCommands';
import CommunityCommandPicker from './CommunityCommandPicker';
import CommandForm from './CommandForm';
import CommandActivityCard from './CommandActivityCard';

export default function CommunityActivityBoard({ community }: { community: CommunityDetail }) {
  const dialog = useRef<HTMLElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<CommandMetadata | null>(null);
  const [filter, setFilter] = useState<CommandId | undefined>();
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const canCompose = community.membershipStatus === 'ACTIVE' && community.status === 'ACTIVE';
  const commands = useCommunityCommands(community.id, canCompose);
  const activities = useCommunityActivities(community.id, filter, true);
  const seen = new Set<string>();
  const items = (activities.data?.pages.flatMap((page) => page.items) ?? []).filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  const visibleItems = search.trim()
    ? items.filter((item) =>
        `${item.author.name} ${item.commandLabel} ${JSON.stringify(item.payload)}`
          .toLowerCase()
          .includes(search.trim().toLowerCase())
      )
    : items;
  const published = () => {
    setSelected(null);
    setFilter(undefined);
    setSearch('');
    if (transcript.current) transcript.current.scrollTop = 0;
  };
  useEffect(() => {
    if (!selected) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [selected]);

  return (
    <section className="community-activity-board" aria-labelledby="community-activity-heading">
      <header className="community-activity-heading" inert={!!selected}>
        <span className="community-chat-emblem" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="m9 7-4 5 4 5m6-10 4 5-4 5m-2-12-2 14" />
          </svg>
        </span>
        <div className="community-chat-title">
          <h1 id="community-activity-heading">{community.name}</h1>
          <p>Professional Community</p>
        </div>
        <span className="community-chat-member-count">
          <span aria-hidden="true" />
          {community.memberCount} {community.memberCount === 1 ? 'member' : 'members'}
        </span>
        <div className="community-chat-toolbar">
          <button
            type="button"
            className="community-chat-icon-button"
            aria-label={searchOpen ? 'Close activity search' : 'Search community activity'}
            aria-expanded={searchOpen}
            onClick={() => {
              setSearchOpen((open) => !open);
              setSearch('');
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m15.5 15.5 5 5" />
            </svg>
          </button>
          <div className="community-activity-filter">
            <label htmlFor="activity-command-filter" className="sr-only">
              Show activity
            </label>
            <select
              id="activity-command-filter"
              value={filter ?? ''}
              onChange={(event) => setFilter((event.target.value || undefined) as CommandId | undefined)}
            >
              <option value="">All activity</option>
              {COMMAND_IDS.map((id) => (
                <option key={id} value={id}>
                  {COMMAND_LABELS[id]}
                </option>
              ))}
            </select>
          </div>
          <details className="community-chat-menu">
            <summary aria-label="More community options">···</summary>
            <nav aria-label="Community options">
              <Link to={`/app/communities/${community.slug}`}>Community overview</Link>
              <Link to={`/app/communities/${community.slug}/members`}>Members</Link>
              <Link to={`/app/communities/${community.slug}/resources`}>Resources</Link>
            </nav>
          </details>
        </div>
      </header>
      {searchOpen && (
        <div className="community-chat-search" inert={!!selected}>
          <div className="community-chat-search-field">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m15.5 15.5 5 5" />
            </svg>
            <input
              type="search"
              autoFocus
              aria-label="Search loaded activity"
              placeholder="Search loaded referrals, resources, events, or members…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.stopPropagation();
                  setSearchOpen(false);
                  setSearch('');
                }
              }}
            />
            {search && (
              <button type="button" aria-label="Clear activity search" onClick={() => setSearch('')}>
                ×
              </button>
            )}
          </div>
          <div className="community-chat-filter-chips" aria-label="Filter activity by command">
            <button type="button" className={!filter ? 'active' : ''} onClick={() => setFilter(undefined)}>
              All
            </button>
            {COMMAND_IDS.map((id) => (
              <button
                key={id}
                type="button"
                className={filter === id ? 'active' : ''}
                onClick={() => setFilter(id)}
              >
                /{id}
              </button>
            ))}
          </div>
        </div>
      )}
      <div
        ref={transcript}
        className="community-chat-transcript"
        role="log"
        aria-label="Community activity"
        inert={!!selected}
      >
        {activities.isPending ? (
          <p className="community-state" role="status">
            Loading activity…
          </p>
        ) : activities.isError ? (
          <div className="community-state" role="alert">
            <p>Community activity could not be loaded.</p>
            <button type="button" className="community-action" onClick={() => void activities.refetch()}>
              Try again
            </button>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="community-chat-empty">
            <span aria-hidden="true">⌕</span>
            <strong>{search || filter ? 'No matching posts found' : 'No community activity yet'}</strong>
            <p>
              {search ? 'No loaded activity matches your search.' : 'No activity matches this filter yet.'}
            </p>
            {(search || filter) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setFilter(undefined);
                }}
              >
                Reset filters
              </button>
            )}
            {activities.hasNextPage && (
              <button
                type="button"
                className="community-load"
                disabled={activities.isFetchingNextPage}
                onClick={() => void activities.fetchNextPage()}
              >
                {activities.isFetchingNextPage ? 'Loading…' : 'Load older activity'}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="command-activity-list">
              {visibleItems.map((item) => (
                <CommandActivityCard key={item.id} activity={item} />
              ))}
            </div>
            {activities.hasNextPage && (
              <button
                type="button"
                className="community-load"
                disabled={activities.isFetchingNextPage}
                onClick={() => void activities.fetchNextPage()}
              >
                {activities.isFetchingNextPage ? 'Loading…' : 'Load more activity'}
              </button>
            )}
          </>
        )}
      </div>
      {canCompose && (
        <footer className="community-command-composer" inert={!!selected}>
          {commands.isPending ? (
            <p role="status">Loading available actions…</p>
          ) : commands.isError ? (
            <p role="alert" className="command-error">
              {apiErrorMessage(commands.error)}
            </p>
          ) : commands.data.commands.length === 0 ? (
            <p>No commands are available here.</p>
          ) : (
            <CommunityCommandPicker commands={commands.data.commands} onSelect={setSelected} />
          )}
        </footer>
      )}
      {selected && createPortal(
        <div
          className="community-chat-compose-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <section
            ref={dialog}
            className="community-chat-compose-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`New ${selected.label.toLowerCase()} contribution`}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                setSelected(null);
                return;
              }
              if (event.key !== 'Tab') return;
              const focusable = dialog.current?.querySelectorAll<HTMLElement>(
                'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]'
              );
              if (!focusable?.length) return;
              const first = focusable[0];
              const last = focusable[focusable.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
            }}
          >
            <header className="community-chat-compose-heading">
              <div>
                <span>/{selected.id}</span>
                <strong>New community contribution</strong>
              </div>
              <button type="button" aria-label="Close contribution form" onClick={() => setSelected(null)}>
                ×
              </button>
            </header>
            <div className="community-chat-compose-body">
              <CommandForm
                key={selected.id}
                communityId={community.id}
                command={selected}
                onCancel={() => setSelected(null)}
                onSuccess={published}
              />
            </div>
          </section>
        </div>,
        document.body
      )}
    </section>
  );
}
