import './monacoEnvironment';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  DesignerUiProvider,
  setHostEditorCapabilities,
  setupMonacoLoader,
  syncColorThemeFromSettingsStore,
} from '@vnext-forge-studio/designer-ui';

import './index.css';
import { AppRouter } from './app/AppRouter';
import { RouteErrorBoundary } from './app/RouteErrorBoundary';
import { SonnerNotificationProvider } from './app/notifications/SonnerNotificationProvider';
import { useCliStore } from './app/store/useCliStore';
import { startWorkspaceFsTreeSync } from './app/store/useProjectListStore';
import { syncRuntimeUrlFromEnvironmentPersist } from './app/store/useEnvironmentStore';
import { config } from './shared/config/config';
import { createHttpTransport } from './transport/HttpTransport';
import { webHostEditorCapabilities } from './shared/host/webHostEditorCapabilities';

const transport = createHttpTransport({ baseUrl: config.apiBaseUrl });
setHostEditorCapabilities(webHostEditorCapabilities());
setupMonacoLoader();

syncColorThemeFromSettingsStore();
startWorkspaceFsTreeSync();

void useCliStore.getState().checkAvailability();

void syncRuntimeUrlFromEnvironmentPersist()
  .catch(() => undefined)
  .finally(() => {
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
  });
