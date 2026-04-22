import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { useProjectStore } from '../../store/useProjectStore.js';

import { CreateVnextConfigDialog } from './CreateVnextConfigDialog.js';

/**
 * `vnext.config.json` için tam-sayfa editör görünümü. Hem web SPA'da
 * (`vNext Config` sekmesi) hem de VS Code webview'inde (custom editor
 * tarafından açılan webview panel) aynı bileşen kullanılır.
 *
 * Altta `CreateVnextConfigDialog`'in `presentation="embedded"` modunu
 * kuşatır; aktif projeyi `useProjectStore`'dan okur ve mevcut config'i
 * okuma/yazma işlemleri host-agnostik `useWriteVnextWorkspaceConfig`
 * üzerinden yapılır.
 */
export interface WorkspaceConfigEditorViewProps {
  /** Üst sekme satırına Save / Undo / Redo çubuğunu yerleştirmek için. */
  registerToolbar?: (toolbar: ReactNode | null) => void;
}

export function WorkspaceConfigEditorView({ registerToolbar }: WorkspaceConfigEditorViewProps) {
  const activeProject = useProjectStore((s) => s.activeProject);
  const setVnextConfig = useProjectStore((s) => s.setVnextConfig);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOpen(true);
  }, [activeProject?.id]);

  const handleCompleted = useCallback(
    (_nextProjectId: string) => {
      // `setVnextConfig` referansını korumak için bilinçli olarak aldık;
      // CreateVnextConfigDialog kendi içinde `WorkspaceApi.writeFile`
      // sonrası store'u güncellemediği için, bir sonraki render'da
      // güncel veriyi okumak için projeyi yeniden mount etmek yerine
      // projectStore'un mevcut snapshot'ına dokunmuyoruz; üst host
      // (web pages / extension HostEditorBridge) gerekirse refresh yapar.
      void _nextProjectId;
      void setVnextConfig;
    },
    [setVnextConfig],
  );

  if (!activeProject) {
    return (
      <div className="bg-background text-foreground flex h-full w-full items-center justify-center">
        <div className="max-w-md text-center">
          <h2 className="text-base font-semibold">vNext Config</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Aktif proje bulunamadı. Lütfen bir vNext workspace açın.
          </p>
        </div>
      </div>
    );
  }

  return (
    <CreateVnextConfigDialog
      projectId={activeProject.id}
      defaultDomain={activeProject.domain}
      open={open}
      onOpenChange={setOpen}
      onCompleted={handleCompleted}
      presentation="embedded"
      registerToolbar={registerToolbar}
    />
  );
}
