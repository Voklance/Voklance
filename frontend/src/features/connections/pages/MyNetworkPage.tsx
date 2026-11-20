import type { ConnectionDto } from '@voklance/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { apiErrorMessage } from '@/lib/apiClient';
import NetworkPrivacySettings from '../components/NetworkPrivacySettings';
import StartConversationButton from '@/features/messaging/components/StartConversationButton';
import { useMyConnections, useNetworkActions, useNetworkCounts, useRequests } from '../hooks/useNetwork';

type Tab = 'connections' | 'incoming' | 'sent' | 'privacy';
const tabs: { id: Tab; label: string }[] = [
  { id: 'connections', label: 'My Connections' },
  { id: 'incoming', label: 'Received Requests' },
  { id: 'sent', label: 'Sent Requests' },
  { id: 'privacy', label: 'Privacy' }
];
export default function MyNetworkPage() {
  const [params, setParams] = useSearchParams();
  const tab = tabs.find((item) => item.id === params.get('tab'))?.id ?? 'connections';
  const search = params.get('search') ?? '';
  const [draft, setDraft] = useState(search);
  useEffect(() => setDraft(search), [search]);
  const counts = useNetworkCounts();
  const mine = useMyConnections(search, tab === 'connections');
  const incoming = useRequests('incoming', tab === 'incoming');
  const sent = useRequests('sent', tab === 'sent');
  const actions = useNetworkActions();
  const query = tab === 'connections' ? mine : tab === 'incoming' ? incoming : sent;
  const items = [
    ...new Map(query.data?.pages.flatMap((page) => page.items).map((item) => [item.id, item]) ?? []).values()
  ];
  const choose = (value: Tab) => setParams(value === 'connections' ? {} : { tab: value });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setParams(draft.trim() ? { search: draft.trim() } : {});
  };
  const pending =
    actions.accept.isPending ||
    actions.decline.isPending ||
    actions.cancel.isPending ||
    actions.remove.isPending;
  const actionError =
    actions.accept.error ?? actions.decline.error ?? actions.cancel.error ?? actions.remove.error;
  const perform = (connection: ConnectionDto, action: 'accept' | 'decline' | 'cancel' | 'remove') => {
    if (
      (action === 'decline' || action === 'remove') &&
      !window.confirm(action === 'remove' ? 'Remove this connection?' : 'Decline this request?')
    )
      return;
    actions[action].mutate(connection.id);
  };
  return (
    <div className="network-page">
      <header className="network-hero">
        <div>
          <p className="network-eyebrow">People you know</p>
          <h1>My Network</h1>
          <p>Build and manage your professional connections.</p>
        </div>
        <Link className="community-primary" to="/app/network/discover">
          Discover Professionals
        </Link>
      </header>
      <div className="network-stats" aria-label="Network counts">
        <span>
          <strong>{counts.data?.counts.connections ?? '—'}</strong> Connections
        </span>
        <span>
          <strong>{counts.data?.counts.incoming ?? '—'}</strong> Received
        </span>
        <span>
          <strong>{counts.data?.counts.sent ?? '—'}</strong> Sent
        </span>
      </div>
      <nav className="network-tabs" aria-label="Network sections">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? 'active' : ''}
            aria-current={tab === item.id ? 'page' : undefined}
            onClick={() => choose(item.id)}
          >
            {item.label}
            {item.id === 'incoming' && !!counts.data?.counts.incoming && (
              <span className="network-tab-count">{counts.data.counts.incoming}</span>
            )}
          </button>
        ))}
      </nav>
      {tab === 'privacy' ? (
        <NetworkPrivacySettings />
      ) : (
        <>
          {tab === 'connections' && (
            <form className="network-filters" role="search" onSubmit={submit}>
              <label>
                Search connections
                <input
                  type="search"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Search by name"
                />
              </label>
              <button type="submit" className="community-action">
                Search
              </button>
            </form>
          )}
          {actionError && (
            <p role="alert" className="form-alert">
              {apiErrorMessage(actionError)}
            </p>
          )}
          {query.isPending ? (
            <p className="community-state" role="status">
              Loading {tab}…
            </p>
          ) : query.isError ? (
            <div className="community-state" role="alert">
              <p>Could not load {tab}.</p>
              <button type="button" className="community-action" onClick={() => void query.refetch()}>
                Try again
              </button>
            </div>
          ) : items.length === 0 ? (
            <p className="community-state">
              {tab === 'connections'
                ? 'No connections found. Explore professionals to grow your network.'
                : tab === 'incoming'
                  ? 'No received requests.'
                  : 'No sent requests.'}
            </p>
          ) : (
            <>
              <div className="network-list">
                {items.map((item) => (
                  <article className="network-row" key={item.id}>
                    <div className="network-row-person">
                      <span className="network-avatar" aria-hidden="true">
                        {item.person?.fullName.charAt(0).toUpperCase() ?? '?'}
                      </span>
                      <div>
                        <h2>
                          {item.person ? (
                            <Link to={`/app/professionals/${item.person.username}`}>
                              {item.person.fullName}
                            </Link>
                          ) : (
                            'Private profile'
                          )}
                        </h2>
                        <p>{item.person?.headline ?? 'Profile details unavailable'}</p>
                        {item.person && (
                          <small>{[item.person.city, item.person.country].filter(Boolean).join(', ')}</small>
                        )}
                      </div>
                    </div>
                    <div className="network-row-actions">
                      {tab === 'incoming' ? (
                        <>
                          <button
                            type="button"
                            className="community-primary"
                            disabled={pending}
                            onClick={() => perform(item, 'accept')}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            className="community-action"
                            disabled={pending}
                            onClick={() => perform(item, 'decline')}
                          >
                            Decline
                          </button>
                        </>
                      ) : tab === 'sent' ? (
                        <button
                          type="button"
                          className="community-action"
                          disabled={pending}
                          onClick={() => perform(item, 'cancel')}
                        >
                          Cancel request
                        </button>
                      ) : (
                        <>
                          {item.person && <StartConversationButton username={item.person.username} />}
                          <button
                            type="button"
                            className="community-action"
                            disabled={pending}
                            onClick={() => perform(item, 'remove')}
                          >
                            Remove connection
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              {query.hasNextPage && (
                <button
                  type="button"
                  className="community-load"
                  disabled={query.isFetchingNextPage}
                  onClick={() => void query.fetchNextPage()}
                >
                  {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
