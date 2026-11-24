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
  const defaultCommand =
    commands.find((item) => item.id === 'discussion' && item.enabled) ??
    commands.find((item) => item.enabled);
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
      if (open || error) event.stopPropagation();
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
      <label htmlFor="community-command-input">Choose a command to contribute to this community</label>
      <div className="command-picker-row">
        <div className="command-picker-field">
          <input
            id="community-command-input"
            ref={input}
            type="text"
            role="combobox"
            aria-label="Choose a structured action"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={open && value.startsWith('/')}
            aria-controls="community-command-options"
            aria-activedescendant={
              open && matches[active] ? `command-option-${matches[active].id}` : undefined
            }
            value={value}
            placeholder={
              defaultCommand
                ? `${defaultCommand.command} — ${defaultCommand.description}`
                : 'Type / to browse actions'
            }
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
          <button
            type="button"
            className="command-picker-browse"
            aria-label="Browse commands"
            onClick={() => {
              setValue('/');
              setOpen(true);
              setActive(0);
              input.current?.focus();
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m5 9 7 7 7-7" />
            </svg>
          </button>
        </div>
        <button
          type="button"
          className="command-picker-send"
          aria-label="Start selected command"
          disabled={value.startsWith('/') ? !matches[active]?.enabled : !defaultCommand}
          onClick={() => {
            const chosen = value.startsWith('/') ? matches[active] : defaultCommand;
            if (chosen?.enabled) choose(chosen);
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12h14m-6-6 6 6-6 6" />
          </svg>
        </button>
      </div>
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
