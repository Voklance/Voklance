import { Component, type ErrorInfo, type ReactNode } from 'react';
import ErrorState from './ErrorState';

interface Props {
  children: ReactNode;
}
interface State {
  failed: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application render failed:', error, info.componentStack);
  }

  render() {
    if (this.state.failed)
      return <ErrorState message="Refresh the page to try again." onRetry={() => window.location.reload()} />;
    return this.props.children;
  }
}
