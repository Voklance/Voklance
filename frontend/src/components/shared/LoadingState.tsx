export default function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      {label}
    </div>
  );
}
