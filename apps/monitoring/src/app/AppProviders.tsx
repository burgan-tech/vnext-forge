import { type ReactNode } from 'react';
import { DocumentThemeSync } from '@vnext-forge-studio/designer-ui';

import { SonnerProvider } from './notifications/SonnerProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SonnerProvider>
      <DocumentThemeSync />
      {children}
    </SonnerProvider>
  );
}
