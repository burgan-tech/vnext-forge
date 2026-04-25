import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';

import { useEditorStore } from '@vnext-forge/designer-ui';

import { useVnextWorkspaceUiStore } from '../store/useVnextWorkspaceUiStore';
import { VnextTemplateSeedDialog } from '../../modules/project-workspace/components/VnextTemplateSeedDialog';
import { CodeEditorToolbarProvider, useCodeEditorToolbar } from '../../modules/project-workspace/CodeEditorToolbarContext';
import { EditorTabBar } from '../../modules/project-workspace/components/EditorTabBar';
import { activeTabIdFromPathname } from '../../modules/project-workspace/editorTabRouteSync';
import { buildNavigatePathForTab } from '../../modules/project-workspace/editorTabNavigation';

function ProjectEditorShellInner() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { tabs, activeTabId, setActiveTab, closeTab, clearTabs } = useEditorStore();
  const { toolbar, setToolbar } = useCodeEditorToolbar();
  const templateSeedDialogOpen = useVnextWorkspaceUiStore((s) => s.templateSeedDialogOpen);
  const setTemplateSeedDialogOpen = useVnextWorkspaceUiStore((s) => s.setTemplateSeedDialogOpen);
  const declineTemplatePromptForProject = useVnextWorkspaceUiStore(
    (s) => s.declineTemplatePromptForProject,
  );
  const prevProjectIdRef = useRef<string | undefined>(undefined);

  /**
   * Global sekme store'u projeler arası kalıcıdır. Proje `id` değiştiğinde veya ilk
   * mount'ta (önceki oturumdan kalan sekmeler) temizlenmeli — aksi halde sekme çubuğu
   * yanlış proje / boş sayfa ile çakışır.
   * useLayoutEffect: alt rotadaki `useRegisterComponentEditorTab` useEffect'inden önce
   * çalışır; böylece yeni sekme silinmez.
   */
  useLayoutEffect(() => {
    if (!id) return;
    const prev = prevProjectIdRef.current;
    if (prev !== id) {
      clearTabs();
      setToolbar(null);
    }
    prevProjectIdRef.current = id;
  }, [id, clearTabs, setToolbar]);

  useEffect(() => {
    return () => {
      useEditorStore.getState().clearTabs();
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    const tabId = activeTabIdFromPathname(id, location.pathname);
    if (tabId) {
      setActiveTab(tabId);
    }
  }, [id, location.pathname, setActiveTab]);

  const handleTabClick = useCallback(
    (tabId: string) => {
      if (!id) return;
      setActiveTab(tabId);
      const tab = useEditorStore.getState().tabs.find((t) => t.id === tabId);
      if (!tab) return;
      const path = buildNavigatePathForTab(id, tab);
      if (path) {
        navigate(path, { replace: true });
      }
    },
    [id, navigate, setActiveTab],
  );

  const handleTabClose = useCallback(
    (tabId: string) => {
      closeTab(tabId);
      const { tabs: nextTabs, activeTabId: nextActiveId } = useEditorStore.getState();
      if (!id) return;
      if (nextTabs.length === 0) {
        navigate(`/project/${id}`, { replace: true });
        return;
      }
      const nextActive = nextTabs.find((t) => t.id === nextActiveId);
      if (nextActive) {
        const path = buildNavigatePathForTab(id, nextActive);
        if (path) navigate(path, { replace: true });
      }
    },
    [closeTab, id, navigate],
  );

  const tabCount = tabs.length;
  const showChromeRow = tabCount > 0 || toolbar;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {id ? (
        <VnextTemplateSeedDialog
          open={templateSeedDialogOpen}
          onOpenChange={setTemplateSeedDialogOpen}
          projectId={id}
          onDecline={() => declineTemplatePromptForProject(id)}
        />
      ) : null}

      {showChromeRow ? (
        <div className="border-border bg-muted/25 flex h-9 shrink-0 items-stretch border-b">
          {tabCount > 0 ? (
            <EditorTabBar
              tabs={tabs}
              activeTabId={activeTabId}
              onTabClick={handleTabClick}
              onTabClose={handleTabClose}
            />
          ) : (
            <div className="bg-muted/10 min-w-0 flex-1" aria-hidden />
          )}
          {toolbar ? (
            <div className="border-border bg-background/90 flex max-w-full shrink-0 items-center gap-1 overflow-x-auto border-l px-1.5 py-0.5 backdrop-blur-sm sm:gap-1.5">
              {toolbar}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}

/**
 * Proje altındaki tüm editör rotalarını sarar: ortak sekme çubuğu + `<Outlet />`.
 */
export function ProjectEditorShell() {
  return (
    <CodeEditorToolbarProvider>
      <ProjectEditorShellInner />
    </CodeEditorToolbarProvider>
  );
}
