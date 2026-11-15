import type { CommandMetadata } from '@voklance/shared';
import { useRef, useState, type KeyboardEvent } from 'react';

export default function CommunityCommandPicker({
  commands,
  onSelect
}: {
  commands: CommandMetadata[];
  onSelect: (command: CommandMetadata) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [error, setError] = useState('');
  const matches = value.startsWith('/')
    ? commands.filter((item) => item.command.startsWith(value.toLowerCase()))
    : [];
  const choose = (item: CommandMetadata) => {
    if (!item.enabled) return;
    setValue('');
    setOpen(false);
    setActive(0);
    setError('');
    onSelect(item);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      setError('');
      return;
    }
    if (!open || !value.startsWith('/')) return;
    if (event.key === 'ArrowDown' && matches.length) {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, matches.length - 1));
    }
    if (event.key === 'ArrowUp' && matches.length) {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const chosen = matches[active];
      if (chosen?.enabled) choose(chosen);
      else setError('That command is unavailable. Choose one from the list.');
    }
  };
  return (
    <div className="command-picker">
      <label htmlFor="community-command-input">Choose a structured action</label>
      <input
        id="community-command-input"
        ref={input}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open && value.startsWith('/')}
        aria-controls="community-command-options"
        aria-activedescendant={open && matches[active] ? `command-option-${matches[active].id}` : undefined}
        value={value}
        placeholder="Type / to browse actions"
        onFocus={() => {
          if (value.startsWith('/')) setOpen(true);
        }}
        onChange={(event) => {
          const next = event.target.value;
          setValue(next);
          setOpen(next.startsWith('/'));
          setActive(0);
          setError(
            next && !next.startsWith('/') ? 'Community actions start with /. There is no open chat.' : ''
          );
        }}
        onKeyDown={onKeyDown}
      />
      {open && value.startsWith('/') && (
        <ul id="community-command-options" role="listbox" className="command-options">
          {matches.length === 0 ? (
            <li className="command-option-empty">No matching command.</li>
          ) : (
            matches.map((item, index) => (
              <li
                key={item.id}
                id={`command-option-${item.id}`}
                role="option"
                aria-selected={index === active}
                aria-disabled={!item.enabled}
                className={index === active ? 'selected' : ''}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(item)}
              >
                <strong>{item.command}</strong>
                <span>{item.description}</span>
                {!item.enabled && <span>Unavailable</span>}
              </li>
            ))
          )}
        </ul>
      )}
      {error && (
        <p className="command-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
