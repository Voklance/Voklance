interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <section className="error-state" role="alert">
      <h1>We couldn’t load this page.</h1>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="submit-button" onClick={onRetry}>
          Try again
        </button>
      )}
    </section>
  );
}
