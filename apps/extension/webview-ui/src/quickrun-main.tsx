import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import {
  DesignerUiProvider,
  registerLogSink,
  registerNotificationSink,
} from '@vnext-forge/designer-ui';

import './index.css';
import { createVsCodeLogSink } from './logging/vscode-log-sink';
import { createVsCodeNotificationSink } from './notifications/vscode-notification-sink';
import { createVsCodeTransport, type VsCodeWebviewApi } from './VsCodeTransport';
import { QuickRunApp } from './quickrun/QuickRunApp';

function getVsCodeApi(): VsCodeWebviewApi {
  if (typeof window.acquireVsCodeApi === 'function') {
    return window.acquireVsCodeApi();
  }
  return {
    postMessage: () => undefined,
    getState: () => undefined,
    setState: () => undefined,
  };
}

const vsCodeApi = getVsCodeApi();
const transport = createVsCodeTransport(vsCodeApi);

registerNotificationSink(createVsCodeNotificationSink(vsCodeApi));
registerLogSink(createVsCodeLogSink(vsCodeApi));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DesignerUiProvider transport={transport}>
      <QuickRunApp api={vsCodeApi} />
    </DesignerUiProvider>
  </StrictMode>,
);
