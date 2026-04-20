import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DesignerUiProvider } from '@vnext-forge/designer-ui';

import './index.css';
import { AppRouter } from './app/AppRouter';
import { SonnerNotificationProvider } from './app/notifications/SonnerNotificationProvider';
import { config } from './shared/config/config';
import { createHttpTransport } from './transport/HttpTransport';

const transport = createHttpTransport({ baseUrl: config.apiBaseUrl });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DesignerUiProvider transport={transport}>
      <SonnerNotificationProvider>
        <AppRouter />
      </SonnerNotificationProvider>
    </DesignerUiProvider>
  </StrictMode>,
);
