import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { DesignerUiProvider } from '@vnext-forge/designer-ui';

import './index.css';
import { HostEditorBridge } from './HostEditorBridge';
import { createVsCodeTransport, type VsCodeWebviewApi } from './VsCodeTransport';

/**
 * Resolve the VS Code webview API. Outside the webview runtime we fall back
 * to a no-op stub so the bundle can also be served by a plain `vite dev`
 * session for styling work.
 */
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

/*
 * The VS Code webview is intentionally router-less. Navigation between
 * editors is driven by the host (file clicks, context menu commands), not by
 * URL state inside the webview. `HostEditorBridge` listens for `open-editor`
 * frames from the extension host and renders the matching designer view.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DesignerUiProvider transport={transport}>
      <HostEditorBridge api={vsCodeApi} />
    </DesignerUiProvider>
  </StrictMode>,
);
