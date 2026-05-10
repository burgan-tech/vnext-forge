import { useEffect, useRef } from 'react';

import {
  DEFAULT_WORKSPACE_SESSION,
  getSession,
  saveSession,
  useEditorStore,
  useQuickSwitcherStore,
  type EditorTab,
  type SessionEditorTab,
  type WorkspaceSession,
} from '@vnext-forge-studio/designer-ui';

import { useWebShellStore, type SidebarView } from '../../app/store/useWebShellStore';

const PERSIST_DEBOUNCE_MS = 1000;

const KNOWN_SIDEBAR_VIEWS: SidebarView[] = [
  'project',
  'search',
  'snippets',
  'validation',
  'templates',
];

function toSessionTab(tab: EditorTab): SessionEditorTab {
  // Strip transient fields (`isDirty`, `content`); persist only the bits we
  // need to reconstitute the tab on next launch.
  return {
    id: tab.id,
    kind: tab.kind,
    title: tab.title,
    ...(tab.filePath ? { filePath: tab.filePath } : {}),
    ...(tab.language ? { language: tab.language } : {}),
    ...(tab.componentKind ? { componentKind: tab.componentKind } : {}),
    ...(tab.group ? { group: tab.group } : {}),
    ...(tab.name ? { name: tab.name } : {}),
  };
}

function fromSessionTab(tab: SessionEditorTab): EditorTab | null {
  if (!tab.id) return null;
  // EditorTab requires kind + title; both are technically optional in the
  // session schema (we wrote loose). Fall back to safe defaults rather than
  // dropping the tab.
  const kind = (tab.kind as EditorTab['kind']) ?? 'file';
  return {
    id: tab.id,
    kind,
    title: tab.title ?? tab.id,
    isDirty: false,
    ...(typeof tab.filePath === 'string' ? { filePath: tab.filePath } : {}),
    ...(typeof tab.language === 'string' ? { language: tab.language } : {}),
    ...(typeof tab.componentKind === 'string'
      ? { componentKind: tab.componentKind as EditorTab['componentKind'] }
      : {}),
    ...(typeof tab.group === 'string' ? { group: tab.group } : {}),
    ...(typeof tab.name === 'string' ? { name: tab.name } : {}),
  };
}

function isKnownSidebarView(value: string): value is SidebarView {
  return (KNOWN_SIDEBAR_VIEWS as string[]).includes(value);
}

function buildSnapshot(): WorkspaceSession {
  const editor = useEditorStore.getState();
  const shell = useWebShellStore.getState();
  return {
    version: 1,
    editor: {
      open: editor.tabs.map(toSessionTab),
      activeTabId: editor.activeTabId,
    },
    sidebar: {
      view: shell.sidebarView,
      open: shell.sidebarOpen,
      width: shell.sidebarWidth,
    },
    runtime: { activeConnectionId: null },
    palette: {
      lastQuickSwitcherQuery: useQuickSwitcherStore.getState().query || undefined,
    },
  };
}

/**
 * Per-project workspace session bridge: restores on `projectId` change and
 * debounce-persists store changes to `<project>/.vnextstudio/session.json`.
 *
 * We deliberately keep a single hook (not split restore/persist) so the
 * "did we restore yet?" gate naturally lives in one ref — preventing the
 * persist debouncer from racing the initial restore and overwriting saved
 * state with empty defaults.
 */
export function useWorkspaceSession(projectId: string | null): void {
  // True for the active projectId once `getSession` resolves. Resets when
  // the user switches projects so persist stays paused during the next
  // restore window.
  const restoredForRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSerializedRef = useRef<string | null>(null);

  // ── restore ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!projectId) {
      restoredForRef.current = null;
      return;
    }
    if (restoredForRef.current === projectId) return;

    let cancelled = false;
    restoredForRef.current = null;
    void (async () => {
      try {
        const session = (await getSession(projectId)) ?? DEFAULT_WORKSPACE_SESSION;
        if (cancelled) return;

        // Apply tabs.
        const editorState = useEditorStore.getState();
        const restoredTabs = (session.editor?.open ?? [])
          .map(fromSessionTab)
          .filter((t): t is EditorTab => t !== null);
        editorState.clearTabs();
        for (const tab of restoredTabs) {
          editorState.openTab(tab);
        }
        const targetActive =
          session.editor?.activeTabId &&
          restoredTabs.some((t) => t.id === session.editor.activeTabId)
            ? session.editor.activeTabId
            : (restoredTabs[restoredTabs.length - 1]?.id ?? null);
        if (targetActive) editorState.setActiveTab(targetActive);

        // Apply sidebar.
        const shell = useWebShellStore.getState();
        const sidebar = session.sidebar;
        if (sidebar) {
          if (typeof sidebar.width === 'number' && sidebar.width > 0) {
            shell.setSidebarWidth(sidebar.width);
          }
          if (typeof sidebar.view === 'string' && isKnownSidebarView(sidebar.view)) {
            shell.setSidebarView(sidebar.view);
          }
          if (typeof sidebar.open === 'boolean' && sidebar.open !== shell.sidebarOpen) {
            shell.toggleSidebar();
          }
        }

        // Mark restore complete; future store changes start being persisted.
        restoredForRef.current = projectId;
        // Seed the deduper so a no-op snapshot doesn't trigger an immediate
        // write right after restore.
        lastSerializedRef.current = JSON.stringify(buildSnapshot());
      } catch {
        // Restore failure is intentionally non-fatal; the user keeps a
        // working app with default state. The server already logged the
        // root cause.
        restoredForRef.current = projectId;
        lastSerializedRef.current = JSON.stringify(buildSnapshot());
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // ── persist (debounced) ────────────────────────────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    // Capture into a non-null const so closures keep TS narrowing.
    const pid: string = projectId;

    function schedulePersist() {
      if (restoredForRef.current !== pid) return;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        const snapshot = buildSnapshot();
        const serialized = JSON.stringify(snapshot);
        if (serialized === lastSerializedRef.current) return;
        lastSerializedRef.current = serialized;
        // Fire-and-forget — failures are non-fatal; the next change will retry.
        void saveSession(pid, snapshot).catch(() => undefined);
      }, PERSIST_DEBOUNCE_MS);
    }

    const unsubEditor = useEditorStore.subscribe(() => schedulePersist());
    const unsubShell = useWebShellStore.subscribe(() => schedulePersist());

    return () => {
      unsubEditor();
      unsubShell();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [projectId]);

  // ── flush on unload ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    const pid: string = projectId;
    function handleBeforeUnload() {
      if (restoredForRef.current !== pid) return;
      const snapshot = buildSnapshot();
      const serialized = JSON.stringify(snapshot);
      if (serialized === lastSerializedRef.current) return;
      lastSerializedRef.current = serialized;
      // Best-effort sync flush. Even if the request doesn't complete before
      // the renderer dies we don't lose much — the debounce already wrote a
      // recent snapshot at most a second ago.
      void saveSession(pid, snapshot).catch(() => undefined);
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [projectId]);
}
