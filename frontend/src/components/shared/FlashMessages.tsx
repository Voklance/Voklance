import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import { Link } from 'react-router';

export type FlashType = 'success' | 'error' | 'warning' | 'info';
type FlashInput = { type: FlashType; message: string; title?: string; to?: string };
type FlashItem = FlashInput & { id: number };
type FlashContextValue = { showFlash: (flash: FlashInput) => void };

const FlashContext = createContext<FlashContextValue>({ showFlash: () => undefined });
const titles: Record<FlashType, string> = {
  success: 'Well done!',
  error: 'Oh snap!',
  warning: 'Warning!',
  info: 'Hi there!'
};

function FlashIcon({ type }: { type: FlashType }) {
  return (
    <span className="flash-icon" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {type === 'success' && <path d="m5 12 4 4L19 6" />}
        {type === 'error' && <path d="M6 6 18 18M18 6 6 18" />}
        {type === 'warning' && (
          <>
            <path d="M10.3 4.7 2.5 18.1A2 2 0 0 0 4.2 21h15.6a2 2 0 0 0 1.7-2.9L13.7 4.7a2 2 0 0 0-3.4 0Z" />
            <path d="M12 10v4" />
            <path d="M12 17h.01" />
          </>
        )}
        {type === 'info' && (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M9.7 9.1a2.5 2.5 0 0 1 4.6 1.4c0 1.7-2.3 2.1-2.3 3.5" />
            <path d="M12 17h.01" />
          </>
        )}
      </svg>
    </span>
  );
}

export function FlashProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FlashItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);
  const showFlash = useCallback(
    (flash: FlashInput) => {
      const id = ++nextId.current;
      setItems((current) => [...current.slice(-3), { ...flash, id }]);
      const duration = flash.type === 'error' ? 10_000 : 6_000;
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration)
      );
    },
    [dismiss]
  );
  const contextValue = useMemo(() => ({ showFlash }), [showFlash]);
  useEffect(
    () => () => {
      for (const timer of timers.current.values()) clearTimeout(timer);
      timers.current.clear();
    },
    []
  );

  return (
    <FlashContext.Provider value={contextValue}>
      {children}
      {items.length > 0 && (
        <div className="flash-stack" aria-label="Flash messages">
          {items.map((item) => {
            const title = item.title ?? titles[item.type];
            const content = (
              <>
                <strong>{title}</strong>
                <span>{item.message}</span>
              </>
            );
            return (
              <div
                className="flash-message"
                data-type={item.type}
                role={item.type === 'error' || item.type === 'warning' ? 'alert' : 'status'}
                key={item.id}
              >
                <FlashIcon type={item.type} />
                {item.to ? (
                  <Link className="flash-copy" to={item.to} onClick={() => dismiss(item.id)}>
                    {content}
                  </Link>
                ) : (
                  <div className="flash-copy">{content}</div>
                )}
                <button
                  type="button"
                  className="flash-dismiss"
                  onClick={() => dismiss(item.id)}
                  aria-label={`Dismiss ${title} message`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M6 6 18 18M18 6 6 18" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </FlashContext.Provider>
  );
}

export function useFlash() {
  return useContext(FlashContext);
}
