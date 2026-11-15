import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import { queryClient } from '@/lib/queryClient';
import type { ReactNode } from 'react';

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
