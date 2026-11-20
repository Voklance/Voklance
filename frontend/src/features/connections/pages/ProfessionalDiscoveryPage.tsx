import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import ProfessionalCard from '../components/ProfessionalCard';
import { useProfessionals } from '../hooks/useNetwork';

export default function ProfessionalDiscoveryPage() {
  const [params, setParams] = useSearchParams();
  const searchParam = params.get('search') ?? '';
  const skillParam = params.get('skill') ?? '';
  const locationParam = params.get('location') ?? '';
  const [draft, setDraft] = useState(searchParam);
  const [skillDraft, setSkillDraft] = useState(skillParam);
  const [locationDraft, setLocationDraft] = useState(locationParam);
  useEffect(() => {
    setDraft(searchParam);
    setSkillDraft(skillParam);
    setLocationDraft(locationParam);
  }, [searchParam, skillParam, locationParam]);
  const filters = {
    search: searchParam || undefined,
    skill: skillParam || undefined,
    location: locationParam || undefined
  };
  const query = useProfessionals(filters);
  const items = [
    ...new Map(
      query.data?.pages.flatMap((page) => page.items).map((item) => [item.userId, item]) ?? []
    ).values()
  ];
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next = new URLSearchParams();
    if (draft.trim()) next.set('search', draft.trim());
    if (skillDraft.trim()) next.set('skill', skillDraft.trim());
    if (locationDraft.trim()) next.set('location', locationDraft.trim());
    setParams(next);
  };
  return (
    <div className="network-page">
      <header className="network-hero">
        <div>
          <p className="network-eyebrow">Your professional circle</p>
          <h1>Discover Professionals</h1>
          <p>Find professionals who share your skills, expertise, and career interests.</p>
        </div>
        <Link to="/app/network">My Network</Link>
      </header>
      <form className="network-filters" role="search" onSubmit={submit}>
        <label>
          Search by name or headline
          <input
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Search professionals"
          />
        </label>
        <button type="submit" className="community-action">
          Search
        </button>
        <label>
          Skill
          <input
            type="search"
            value={skillDraft}
            onChange={(event) => setSkillDraft(event.target.value)}
            placeholder="Skill name or slug"
          />
        </label>
        <label>
          Location
          <input
            type="search"
            value={locationDraft}
            onChange={(event) => setLocationDraft(event.target.value)}
            placeholder="City or country"
          />
        </label>
      </form>
      {query.isPending ? (
        <p role="status" className="community-state">
          Loading professionals…
        </p>
      ) : query.isError ? (
        <div role="alert" className="community-state">
          <p>Professionals could not be loaded.</p>
          <button type="button" className="community-action" onClick={() => void query.refetch()}>
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="community-state">No professionals match these filters.</p>
      ) : (
        <>
          <div className="network-grid">
            {items.map((person) => (
              <ProfessionalCard key={person.userId} person={person} />
            ))}
          </div>
          {query.hasNextPage && (
            <button
              className="community-load"
              type="button"
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {query.isFetchingNextPage ? 'Loading…' : 'Load more professionals'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
