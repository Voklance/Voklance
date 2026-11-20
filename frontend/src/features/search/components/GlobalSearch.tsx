import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { searchApi } from '../api/searchApi';

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(draft.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [draft]);
  const suggestions = useQuery({
    queryKey: ['search', 'suggestions', debounced],
    queryFn: () => searchApi.suggestions(debounced),
    enabled: open && debounced.length >= 2,
    staleTime: 30_000
  });
  const items = suggestions.data ?? [];
  function submit(event: FormEvent) {
    event.preventDefault();
    const q = draft.trim();
    if (q.length < 2) return;
    setOpen(false);
    navigate(`/app/search?q=${encodeURIComponent(q)}`);
  }
  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((value) => Math.min(value + 1, items.length - 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((value) => Math.max(value - 1, -1));
    }
    if (event.key === 'Enter' && active >= 0 && items[active]) {
      event.preventDefault();
      setOpen(false);
      navigate(items[active].href);
    }
  }
  return (
    <form className="global-search" role="search" onSubmit={submit}>
      <label className="sr-only" htmlFor="global-search-input">
        Search Voklance
      </label>
      <input
        id="global-search-input"
        type="search"
        autoComplete="off"
        placeholder="Search people, posts, communities…"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={keyDown}
        aria-controls="global-search-suggestions"
        aria-expanded={open && draft.trim().length >= 2}
        aria-activedescendant={active >= 0 ? `global-search-result-${active}` : undefined}
      />
      <button type="submit" aria-label="Search">
        Search
      </button>
      {open && draft.trim().length >= 2 && (
        <div
          id="global-search-suggestions"
          className="global-search-suggestions"
          role="listbox"
          aria-label="Search suggestions"
        >
          {suggestions.isPending && <p role="status">Searching…</p>}
          {suggestions.isError && <p>Suggestions unavailable. Press Enter for full search.</p>}
          {items.map((item, index) => (
            <Link
              role="option"
              aria-selected={active === index}
              id={`global-search-result-${index}`}
              key={item.id}
              to={item.href}
              onClick={() => setOpen(false)}
            >
              <span>{item.title}</span>
              <small>{item.category}</small>
            </Link>
          ))}
          {suggestions.isSuccess && items.length === 0 && <p>No quick matches. Press Enter to search all.</p>}
        </div>
      )}
    </form>
  );
}
