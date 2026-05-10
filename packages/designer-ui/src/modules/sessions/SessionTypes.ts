/**
 * Local mirror of `WorkspaceSession` from
 * `packages/services-core/src/services/sessions/sessions-schemas.ts`.
 * designer-ui never imports services-core, so we duplicate the shape here.
 *
 * Every field is optional / loose because the on-disk format is permissive
 * — the shell rebuilds invalid slices from defaults rather than failing.
 */

export interface SessionEditorTab {
  id: string;
  kind?: string;
  title?: string;
  filePath?: string;
  language?: string;
  componentKind?: string;
  group?: string;
  name?: string;
  [extra: string]: unknown;
}

export interface SessionEditorState {
  open: SessionEditorTab[];
  activeTabId: string | null;
}

export interface SessionSidebarState {
  view: string;
  open: boolean;
  width: number;
}

export interface SessionRuntimeState {
  activeConnectionId: string | null;
}

export interface SessionPaletteState {
  lastQuickSwitcherQuery?: string;
  lastSearchQuery?: string;
  lastSnippetQuery?: string;
}

export interface WorkspaceSession {
  version: 1;
  editor: SessionEditorState;
  sidebar: SessionSidebarState;
  runtime: SessionRuntimeState;
  palette: SessionPaletteState;
  lastSavedAt?: string;
}

export const DEFAULT_WORKSPACE_SESSION: WorkspaceSession = {
  version: 1,
  editor: { open: [], activeTabId: null },
  sidebar: { view: 'project', open: true, width: 230 },
  runtime: { activeConnectionId: null },
  palette: {},
};
