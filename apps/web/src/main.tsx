import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DesignerUiProvider, setHostEditorCapabilities } from '@vnext-forge/designer-ui';

import './index.css';
import { AppRouter } from './app/AppRouter';
import { RouteErrorBoundary } from './app/RouteErrorBoundary';
import { SonnerNotificationProvider } from './app/notifications/SonnerNotificationProvider';
import { config } from './shared/config/config';
import { createHttpTransport } from './transport/HttpTransport';
import { webHostEditorCapabilities } from './shared/host/webHostEditorCapabilities';

const transport = createHttpTransport({ baseUrl: config.apiBaseUrl });
setHostEditorCapabilities(webHostEditorCapabilities());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DesignerUiProvider transport={transport}>
      <SonnerNotificationProvider>
        <RouteErrorBoundary>
          <AppRouter />
        </RouteErrorBoundary>
      </SonnerNotificationProvider>
    </DesignerUiProvider>
  </StrictMode>,
);
