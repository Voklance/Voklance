import type { CatalogItem, CatalogPage } from '@voklance/shared';
import type { UseQueryResult } from '@tanstack/react-query';

export default function CatalogSelector({
  kind,
  search,
  onSearch,
  selected,
  onChange,
  catalog
}: {
  kind: 'skill' | 'interest';
  search: string;
  onSearch: (value: string) => void;
  selected: CatalogItem[];
  onChange: (items: CatalogItem[]) => void;
  catalog: UseQueryResult<CatalogPage, Error>;
}) {
  const title = kind === 'skill' ? 'skills' : 'interests';
  const selectedIds = new Set(selected.map((item) => item.id));
  return (
    <div className="catalog-selector">
      <label htmlFor={`${kind}-search`}>Search {title}</label>
      <input
        id={`${kind}-search`}
        type="search"
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        placeholder={`Find ${title}`}
      />
      <p className="onboarding-hint">Choose at least one, up to 30. {selected.length} selected.</p>
      {selected.length > 0 && (
        <div className="selected-chips" aria-label={`Selected ${title}`}>
          {selected.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => onChange(selected.filter((chosen) => chosen.id !== item.id))}
              aria-label={`Remove ${item.name}`}
            >
              {item.name} <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}
      {catalog.isPending && <p role="status">Loading {title}…</p>}
      {catalog.isError && (
        <div role="alert">
          <p>Could not load {title}.</p>
          <button type="button" className="onboarding-text-button" onClick={() => void catalog.refetch()}>
            Try again
          </button>
        </div>
      )}
      {catalog.data && (
        <>
          {catalog.data.items.length === 0 && (
            <p className="onboarding-empty">No {title} found. Try another search.</p>
          )}
          <div className="catalog-results" role="group" aria-label={`Available ${title}`}>
            {catalog.data.items.map((item) => (
              <label key={item.id} className="catalog-result">
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  disabled={!selectedIds.has(item.id) && selected.length >= 30}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...selected, item]
                        : selected.filter((chosen) => chosen.id !== item.id)
                    )
                  }
                />
                <span>{item.name}</span>
                <small>{item.category}</small>
              </label>
            ))}
          </div>
          {catalog.data.total > catalog.data.items.length && (
            <p className="onboarding-hint">Showing the first 50 results. Search to narrow the list.</p>
          )}
        </>
      )}
    </div>
  );
}
