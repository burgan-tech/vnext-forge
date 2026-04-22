import { useCallback, useEffect, useState } from 'react';

import {
  createLogger,
  ExtensionEditorView,
  FlowEditorView,
  FunctionEditorView,
  isMessageOriginAllowed,
  SchemaEditorView,
  TaskEditorView,
  useEditorStore,
  useProjectStore,
  ViewEditorView,
  WorkspaceConfigEditorView,
  type VnextWorkspaceConfig,
} from '@vnext-forge/designer-ui';

import { resolveWebviewPostMessageAllowedOrigins } from './host/webviewMessageOrigins.js';
import type { VsCodeWebviewApi } from './VsCodeTransport';

const logger = createLogger('extension/HostEditorBridge');

/**
 * Editor "kinds" the host can ask the webview to render. Mirrors
 * `DesignerEditorKind` in `apps/extension/src/panels/DesignerPanel.ts`.
 */
type EditorKind =
  | 'workflow'
  | 'task'
  | 'schema'
  | 'view'
  | 'function'
  | 'extension'
  | 'config';

/**
 * `open-editor` frame sent by the extension host. VS Code shell'de ayrı sekme çubuğu
 * yok: tek `WebviewPanel` sekmesi + panel başlığı/ikonu host tarafında (`DesignerPanel`).
 */
interface HostOpenEditorMessage {
  type: 'open-editor';
  kind: EditorKind;
  projectId: string;
  projectPath: string;
  projectDomain: string;
  group: string;
  name: string;
  filePath: string;
  vnextConfig: VnextWorkspaceConfig;
}

function isOpenEditorMessage(value: unknown): value is HostOpenEditorMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'open-editor' &&
    typeof (value as { projectId?: unknown }).projectId === 'string' &&
    typeof (value as { kind?: unknown }).kind === 'string'
  );
}

export interface HostEditorBridgeProps {
  api: VsCodeWebviewApi;
}

/**
 * Web SPA’daki `EditorTabBar` burada yok: sekme kromu yalnızca VS Code’un kendi
 * sekmesinde (webview panel `title` + `iconPath`).
 */
export function HostEditorBridge({ api }: HostEditorBridgeProps) {
  const [active, setActive] = useState<HostOpenEditorMessage | null>(null);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const setVnextConfig = useProjectStore((s) => s.setVnextConfig);

  const applyOpenEditor = useCallback(
    (data: HostOpenEditorMessage) => {
      setActiveProject({
        id: data.projectId,
        domain: data.projectDomain,
        path: data.projectPath,
        linked: true,
      });
      setVnextConfig(data.vnextConfig);
      setActive(data);
      api.postMessage({
        type: 'host:designer-active-tab',
        kind: data.kind,
        name: data.name,
      });
    },
    [api, setActiveProject, setVnextConfig],
  );

  useEffect(() => {
    // Web bundle içinde kalan `useEditorStore` sekmeleri (SPA ile paylaşılan zustand)
    // extension görünümünü etkilemesin.
    useEditorStore.getState().clearTabs();
  }, []);

  useEffect(() => {
    const allowedOrigins = resolveWebviewPostMessageAllowedOrigins();

    function handle(event: MessageEvent<unknown>) {
      if (!isMessageOriginAllowed(event.origin, allowedOrigins)) {
        logger.warn('Ignoring open-editor postMessage from unexpected origin', {
          origin: event.origin,
        });
        return;
      }

      const data = event.data;
      if (!isOpenEditorMessage(data)) return;
      applyOpenEditor(data);
    }

    window.addEventListener('message', handle);
    api.postMessage({ type: 'webview-ready' });

    return () => {
      window.removeEventListener('message', handle);
    };
  }, [api, applyOpenEditor]);

  return (
    <div className="bg-background text-foreground flex h-screen w-screen min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden">
        {active ? <ActiveEditor payload={active} /> : <EmptyState />}
      </div>
    </div>
  );
}

function ActiveEditor({ payload }: { payload: HostOpenEditorMessage }) {
  const { kind, projectId, group, name } = payload;
  switch (kind) {
    case 'workflow':
      return <FlowEditorView projectId={projectId} group={group} name={name} />;
    case 'task':
      return <TaskEditorView projectId={projectId} group={group} name={name} />;
    case 'schema':
      return <SchemaEditorView projectId={projectId} group={group} name={name} />;
    case 'view':
      return <ViewEditorView projectId={projectId} group={group} name={name} />;
    case 'function':
      return <FunctionEditorView projectId={projectId} group={group} name={name} />;
    case 'extension':
      return <ExtensionEditorView projectId={projectId} group={group} name={name} />;
    case 'config':
      return <WorkspaceConfigEditorView />;
  }
}

function EmptyState() {
  return (
    <div className="bg-background text-foreground flex h-full w-full items-center justify-center">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold">vnext-forge Designer</h1>
        <p className="text-muted-foreground mt-3 text-sm">
          vNext bileşen .json dosyaları Explorer’da açıldığında burada görünür; sağ tık ile
          metin editöründe açabilirsiniz. Sekmeler yalnızca VS Code başlık çubuğundadır.
        </p>
        <p className="text-muted-foreground mt-2 text-xs">
          Komut paletinden &quot;Open Designer&quot; veya bağlam menüsünden dosya seçebilirsiniz.
        </p>
      </div>
    </div>
  );
}
