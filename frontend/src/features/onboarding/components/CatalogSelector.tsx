import type { CatalogItem, CatalogPage } from '@voklance/shared';
import { useMutation, type UseQueryResult } from '@tanstack/react-query';
import { onboardingApi } from '../api/onboardingApi';
import { apiErrorMessage } from '@/lib/apiClient';

export default function CatalogSelector({
  kind,
  search,
  loadedSearch = search,
  onSearch,
  selected,
  onChange,
  catalog
}: {
  kind: 'skill' | 'interest';
  search: string;
  loadedSearch?: string;
  onSearch: (value: string) => void;
  selected: CatalogItem[];
  onChange: (items: CatalogItem[]) => void;
  catalog: UseQueryResult<CatalogPage, Error>;
}) {
  const title = kind === 'skill' ? 'skills' : 'interests';
  const resultsMatchSearch = loadedSearch.trim() === search.trim();
  const selectedIds = new Set(selected.map((item) => item.id));
  const createSkill = useMutation({ mutationFn: onboardingApi.createSkill });
  const newSkill = search.trim().replace(/\s+/g, ' ');
  const exactMatch = catalog.data?.items.some(
    (item) => item.name.toLocaleLowerCase() === newSkill.toLocaleLowerCase()
  );

  async function addSkill() {
    if (kind !== 'skill' || !newSkill || selected.length >= 30) return;
    try {
      const { skill } = await createSkill.mutateAsync(newSkill);
      if (!selectedIds.has(skill.id)) onChange([...selected, skill]);
      await catalog.refetch();
    } catch {
      // The mutation error is shown below the results.
    }
  }
  return (
    <div className="catalog-selector">
      <label htmlFor={`${kind}-search`}>Search {title}</label>
      <input
        id={`${kind}-search`}
        type="search"
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        placeholder={`Find ${title}`}
        maxLength={kind === 'skill' ? 80 : undefined}
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
      {!resultsMatchSearch && <p role="status">Searching {title}…</p>}
      {resultsMatchSearch && catalog.isPending && <p role="status">Loading {title}…</p>}
      {resultsMatchSearch && catalog.isError && (
        <div role="alert">
          <p>Could not load {title}.</p>
          <button type="button" className="onboarding-text-button" onClick={() => void catalog.refetch()}>
            Try again
          </button>
        </div>
      )}
      {resultsMatchSearch && catalog.data && (
        <>
          {catalog.data.items.length === 0 && (
            <p className="onboarding-empty">
              {kind === 'skill'
                ? 'No matching skills yet. Add this skill below.'
                : 'No interests found. Try another search.'}
            </p>
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
            <p className="onboarding-hint">
              {kind === 'skill' && !search.trim()
                ? `Showing ${catalog.data.items.length} suggested skills. Search to find more.`
                : kind === 'interest' && !search.trim()
                  ? `Showing ${catalog.data.items.length} interests. Search to find more.`
                  : `Showing ${catalog.data.items.length} of ${catalog.data.total} results. Refine your search to find more.`}
            </p>
          )}
          {kind === 'skill' && newSkill && !exactMatch && (
            <button
              type="button"
              className="onboarding-text-button"
              disabled={selected.length >= 30 || createSkill.isPending}
              onClick={() => void addSkill()}
            >
              {createSkill.isPending ? 'Adding skill…' : `Add “${newSkill}” as a skill`}
            </button>
          )}
          {kind === 'skill' && createSkill.isError && (
            <p className="onboarding-error" role="alert">
              {apiErrorMessage(createSkill.error)}
            </p>
          )}
        </>
      )}
    </div>
  );
}
