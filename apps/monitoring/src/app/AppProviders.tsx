import { type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { DocumentThemeSync } from '@vnext-forge-studio/designer-ui';

import { queryClient } from '@monitoring/shared/api/query-client';
import { SonnerProvider } from './notifications/SonnerProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SonnerProvider>
        <DocumentThemeSync />
        {children}
      </SonnerProvider>
    </QueryClientProvider>
  );
}
