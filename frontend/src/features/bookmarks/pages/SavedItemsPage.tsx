import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import type { BookmarkType } from '@voklance/shared';
import { apiErrorMessage } from '@/lib/apiClient';
import { bookmarkApi } from '../api/bookmarkApi';

const types: { label: string; value: BookmarkType | '' }[] = [
  { label: 'All items', value: '' },
  { label: 'Posts', value: 'post' },
  { label: 'Resources', value: 'resource' },
  { label: 'Events', value: 'event' },
  { label: 'Referrals', value: 'referral' }
];
export default function SavedItemsPage() {
  const client = useQueryClient();
  const [type, setType] = useState<BookmarkType | ''>('');
  const [collectionId, setCollectionId] = useState('');
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [sort, setSort] = useState('recent');
  const [name, setName] = useState('');
  const collections = useInfiniteQuery({
    queryKey: ['bookmark-collections'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => bookmarkApi.collections(pageParam),
    getNextPageParam: (page) => page.nextCursor ?? undefined
  });
  const collectionItems = collections.data?.pages.flatMap((page) => page.items) ?? [];
  const saved = useInfiniteQuery({
    queryKey: ['saved-items', type, collectionId, term, sort],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      bookmarkApi.saved({
        type: type || undefined,
        collectionId: collectionId || undefined,
        search: term || undefined,
        sort,
        cursor: pageParam
      }),
    getNextPageParam: (page) => page.nextCursor ?? undefined
  });
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['saved-items'] }),
      client.invalidateQueries({ queryKey: ['bookmark-collections'] }),
      client.invalidateQueries({ queryKey: ['feed'] }),
      client.invalidateQueries({ queryKey: ['recommended-feed'] }),
      client.invalidateQueries({ queryKey: ['bookmark-status'] })
    ]);
  };
  const create = useMutation({
    mutationFn: () => bookmarkApi.createCollection(name.trim()),
    onSuccess: async () => {
      setName('');
      await refresh();
    }
  });
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => bookmarkApi.renameCollection(id, name),
    onSuccess: refresh
  });
  const removeCollection = useMutation({
    mutationFn: bookmarkApi.deleteCollection,
    onSuccess: async () => {
      setCollectionId('');
      await refresh();
    }
  });
  const remove = useMutation({ mutationFn: bookmarkApi.remove, onSuccess: refresh });
  const membership = useMutation({
    mutationFn: ({ bookmarkId, targetId, add }: { bookmarkId: string; targetId: string; add: boolean }) =>
      add
        ? bookmarkApi.addToCollection(targetId, bookmarkId)
        : bookmarkApi.removeFromCollection(targetId, bookmarkId),
    onSuccess: refresh
  });
  const items = saved.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <div className="community-page saved-items-page">
      <header className="community-panel">
        <h1>Saved items</h1>
        <p>Your private reading list, organized your way.</p>
        <Link to="/app/activity">View your activity</Link>
      </header>
      <section className="community-panel" aria-label="Saved item filters">
        <div className="saved-filter-row">
          <label>
            Type{' '}
            <select value={type} onChange={(event) => setType(event.target.value as BookmarkType | '')}>
              {types.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Collection{' '}
            <select value={collectionId} onChange={(event) => setCollectionId(event.target.value)}>
              <option value="">All collections</option>
              {collectionItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sort{' '}
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="recent">Recently saved</option>
              <option value="oldest">Oldest saved</option>
              <option value="published">Publication date</option>
            </select>
          </label>
        </div>
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            setTerm(search.trim());
          }}
        >
          <label htmlFor="saved-search">Search saved items</label>
          <div className="saved-filter-row">
            <input
              id="saved-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              maxLength={100}
            />
            <button className="community-action" type="submit">
              Search
            </button>
          </div>
        </form>
      </section>
      <section className="community-panel">
        <h2>Collections</h2>
        <form
          className="saved-filter-row"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) create.mutate();
          }}
        >
          <label htmlFor="collection-name">New collection</label>
          <input
            id="collection-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
          />
          <button className="community-action" disabled={!name.trim() || create.isPending}>
            Create
          </button>
        </form>
        {create.isError && <p role="alert">{apiErrorMessage(create.error)}</p>}
        {collections.isError && (
          <div role="alert">
            <p>Collections could not be loaded.</p>
            <button type="button" onClick={() => void collections.refetch()}>
              Try again
            </button>
          </div>
        )}
        <ul className="saved-collections">
          {collectionItems.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => setCollectionId(item.id)}>
                {item.name} ({item.itemCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  const value = window.prompt('Collection name', item.name)?.trim();
                  if (value && value !== item.name) rename.mutate({ id: item.id, name: value });
                }}
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete ${item.name}? Saved items stay in your list.`))
                    removeCollection.mutate(item.id);
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
        {collections.hasNextPage && (
          <button
            type="button"
            className="community-action"
            disabled={collections.isFetchingNextPage}
            onClick={() => void collections.fetchNextPage()}
          >
            Load more collections
          </button>
        )}
        {(rename.isError || removeCollection.isError) && <p role="alert">Could not update collection.</p>}
      </section>
      <section className="community-panel" aria-live="polite">
        <h2>Items</h2>
        {saved.isPending ? (
          <p role="status">Loading saved items…</p>
        ) : saved.isError ? (
          <div role="alert">
            <p>{apiErrorMessage(saved.error)}</p>
            <button type="button" onClick={() => void saved.refetch()}>
              Try again
            </button>
          </div>
        ) : !items.length ? (
          <p>No saved items match these filters.</p>
        ) : (
          <ul className="saved-item-list">
            {items.map((item) => (
              <li key={item.id} className="saved-item">
                <span className="command-activity-type">{item.entityType}</span>
                <h3>{item.available ? item.title : 'Item unavailable'}</h3>
                {item.available && (
                  <>
                    <p>{item.description}</p>
                    {(item.metadata.author || item.metadata.organizer || item.metadata.uploader) && (
                      <p>{item.metadata.author ?? item.metadata.organizer ?? item.metadata.uploader}</p>
                    )}
                    {item.metadata.company && <p>{item.metadata.company}</p>}
                    {item.metadata.startsAt && (
                      <p>
                        Starts{' '}
                        <time dateTime={String(item.metadata.startsAt)}>
                          {new Date(String(item.metadata.startsAt)).toLocaleString()}
                        </time>
                      </p>
                    )}
                    {item.href && <Link to={item.href}>Open item</Link>}
                  </>
                )}
                <p>
                  Saved <time dateTime={item.savedAt}>{new Date(item.savedAt).toLocaleDateString()}</time>
                </p>
                <div className="saved-filter-row">
                  <button
                    type="button"
                    className="community-action"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(item.id)}
                  >
                    Remove saved
                  </button>
                  {collectionItems.map((collection) => (
                    <label key={collection.id}>
                      <input
                        type="checkbox"
                        checked={item.collectionIds.includes(collection.id)}
                        disabled={membership.isPending}
                        onChange={(event) =>
                          membership.mutate({
                            bookmarkId: item.id,
                            targetId: collection.id,
                            add: event.target.checked
                          })
                        }
                      />
                      {collection.name}
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
        {remove.isError && <p role="alert">{apiErrorMessage(remove.error)}</p>}
        {membership.isError && <p role="alert">{apiErrorMessage(membership.error)}</p>}
        {saved.hasNextPage && (
          <button
            className="community-action"
            disabled={saved.isFetchingNextPage}
            onClick={() => void saved.fetchNextPage()}
          >
            {saved.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        )}
      </section>
    </div>
  );
}
