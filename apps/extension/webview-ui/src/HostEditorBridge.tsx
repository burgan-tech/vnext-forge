import { useEffect, useState } from 'react';

import {
  createLogger,
  ExtensionEditorView,
  FlowEditorView,
  FunctionEditorView,
  isMessageOriginAllowed,
  SchemaEditorView,
  TaskEditorView,
  ViewEditorView,
  useProjectStore,
  type VnextWorkspaceConfig,
} from '@vnext-forge/designer-ui';

import { resolveWebviewPostMessageAllowedOrigins } from './host/webviewMessageOrigins.js';
import type { VsCodeWebviewApi } from './VsCodeTransport';

const logger = createLogger('extension/HostEditorBridge');

/**
 * Editor "kinds" the host can ask the webview to render. Mirrors
 * `DesignerEditorKind` in `apps/extension/src/panels/DesignerPanel.ts`.
 */
type EditorKind = 'workflow' | 'task' | 'schema' | 'view' | 'function' | 'extension';

/**
 * `open-editor` frame sent by the extension host whenever the user activates
 * a vnext component file (right-click → Open Designer, file double-click via
 * a custom command, post-create hook, …). The webview is router-less: each
 * frame describes exactly which editor + project + component to mount.
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

interface ActiveEditor {
  kind: EditorKind;
  projectId: string;
  group: string;
  name: string;
  filePath: string;
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
 * Listens for `open-editor` frames from the extension host, hydrates the
 * shared `useProjectStore` with the active project + its `vnext.config.json`,
 * and renders the matching designer editor.
 *
 * The webview deliberately has no router: in a VS Code extension, navigation
 * is driven by the host (file clicks, commands, custom editor providers).
 * Mounting the right editor is therefore a function of the latest host frame
 * — not URL state inside the webview.
 */
export function HostEditorBridge({ api }: HostEditorBridgeProps) {
  const [active, setActive] = useState<ActiveEditor | null>(null);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const setVnextConfig = useProjectStore((s) => s.setVnextConfig);

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

      setActiveProject({
        id: data.projectId,
        domain: data.projectDomain,
        path: data.projectPath,
        linked: true,
      });
      setVnextConfig(data.vnextConfig);

      setActive({
        kind: data.kind,
        projectId: data.projectId,
        group: data.group,
        name: data.name,
        filePath: data.filePath,
      });
    }

    window.addEventListener('message', handle);
    api.postMessage({ type: 'webview-ready' });

    return () => {
      window.removeEventListener('message', handle);
    };
  }, [api, setActiveProject, setVnextConfig]);

  if (!active) return <EmptyState />;

  switch (active.kind) {
    case 'workflow':
      return (
        <FlowEditorView
          projectId={active.projectId}
          group={active.group}
          name={active.name}
        />
      );
    case 'task':
      return (
        <TaskEditorView
          projectId={active.projectId}
          group={active.group}
          name={active.name}
        />
      );
    case 'schema':
      return (
        <SchemaEditorView
          projectId={active.projectId}
          group={active.group}
          name={active.name}
        />
      );
    case 'view':
      return (
        <ViewEditorView
          projectId={active.projectId}
          group={active.group}
          name={active.name}
        />
      );
    case 'function':
      return (
        <FunctionEditorView
          projectId={active.projectId}
          group={active.group}
          name={active.name}
        />
      );
    case 'extension':
      return (
        <ExtensionEditorView
          projectId={active.projectId}
          group={active.group}
          name={active.name}
        />
      );
  }
}

function EmptyState() {
  return (
    <div className="bg-background text-foreground flex h-screen w-screen items-center justify-center">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold">vnext-forge Designer</h1>
        <p className="text-muted-foreground mt-3 text-sm">
          Open a vnext component from the VS Code Explorer to start designing.
        </p>
        <p className="text-muted-foreground mt-2 text-xs">
          Right-click a <code>.json</code> file under your workspace and choose
          &quot;Open Designer&quot;, or use the Command Palette to create a new
          component.
        </p>
      </div>
    </div>
  );
}
