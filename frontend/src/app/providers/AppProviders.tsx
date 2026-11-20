import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import { FlashProvider } from '@/components/shared/FlashMessages';
import { queryClient } from '@/lib/queryClient';
import type { ReactNode } from 'react';

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <FlashProvider>{children}</FlashProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
