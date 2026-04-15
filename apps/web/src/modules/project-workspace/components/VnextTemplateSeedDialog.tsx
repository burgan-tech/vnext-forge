import { useState } from 'react';
import { FolderPlus, FolderTree } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/ui/Dialog';
import { Button } from '@shared/ui/Button';
import { showNotification } from '@shared/notification/model/notificationStore';
import { useProjectStore } from '@app/store/useProjectStore';
import { useVnextWorkspaceUiStore } from '@app/store/useVnextWorkspaceUiStore';
import {
  getVnextComponentLayoutStatus,
  seedVnextComponentLayout,
} from '@modules/project-management/ProjectApi';
import { toVnextError } from '@shared/lib/error/vNextErrorHelpers';

interface VnextTemplateSeedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onDecline: () => void;
}

export function VnextTemplateSeedDialog({
  open,
  onOpenChange,
  projectId,
  onDecline,
}: VnextTemplateSeedDialogProps) {
  const [pending, setPending] = useState(false);
  const templateSeedDialogReason = useVnextWorkspaceUiStore((s) => s.templateSeedDialogReason);
  const templateSeedMissingPathsPreview = useVnextWorkspaceUiStore(
    (s) => s.templateSeedMissingPathsPreview,
  );

  const isOnlyConfig = templateSeedDialogReason === 'only_config';
  const isIncomplete = templateSeedDialogReason === 'incomplete_layout';

  const title = isOnlyConfig
    ? 'Bileşen klasörlerini oluştur'
    : isIncomplete
      ? 'Eksik klasörleri tamamla'
      : 'Şablon yapısını oluştur';

  const hasMissingPaths =
    templateSeedMissingPathsPreview != null && templateSeedMissingPathsPreview.length > 0;

  const handleConfirm = () => {
    void (async () => {
      setPending(true);
      try {
        const { ensuredPaths } = await seedVnextComponentLayout(projectId);
        onOpenChange(false);
        void useProjectStore.getState().refreshFileTree();
        const layoutRes = await getVnextComponentLayoutStatus(projectId);
        if (layoutRes.success) {
          useVnextWorkspaceUiStore.getState().setComponentLayoutStatus(layoutRes.data);
        } else {
          useVnextWorkspaceUiStore.getState().setComponentLayoutStatus(null);
        }
        showNotification({
          type: 'success',
          message:
            ensuredPaths.length > 0
              ? `${ensuredPaths.length} klasör yolu doğrulandı ve eksikler oluşturuldu.`
              : 'İşlem tamamlandı.',
          modalType: 'toast',
        });
      } catch (error) {
        const err = toVnextError(error);
        showNotification({
          type: 'error',
          message: err.toUserMessage().message,
          modalType: 'toast',
        });
      } finally {
        setPending(false);
      }
    })();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="default" className="max-w-md gap-0 rounded-2xl p-0 sm:max-w-md">
        <div className="space-y-4 px-6 pt-6 pb-4">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex items-center gap-3">
              <div className="bg-info-surface border-info-border flex size-10 shrink-0 items-center justify-center rounded-xl border">
                <FolderPlus className="text-info-icon size-5" />
              </div>
              <DialogTitle className="text-base">{title}</DialogTitle>
            </div>
            <DialogDescription asChild>
              <div className="space-y-3 leading-relaxed">
                {isOnlyConfig ? (
                  <p className="text-muted-foreground text-sm">
                    Proje kökünde yalnızca{' '}
                    <code className="bg-muted rounded px-1 py-0.5 text-xs">vnext.config.json</code>{' '}
                    bulunuyor. Yapılandırmada belirtilen bileşen klasörlerini (Tasks, Views,
                    Workflows vb.) otomatik olarak oluşturabiliriz.
                  </p>
                ) : isIncomplete ? (
                  <p className="text-muted-foreground text-sm">
                    <code className="bg-muted rounded px-1 py-0.5 text-xs">vnext.config.json</code>{' '}
                    yollarına göre bazı bileşen klasörleri eksik. Mevcut klasörlere dokunmadan
                    eksikleri oluşturabiliriz.
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    <code className="bg-muted rounded px-1 py-0.5 text-xs">
                      paths.componentsRoot
                    </code>{' '}
                    altında eksik bileşen klasörlerini oluşturur.
                  </p>
                )}

                {hasMissingPaths ? (
                  <div className="space-y-1.5">
                    <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                      <FolderTree className="size-3.5 shrink-0 opacity-60" />
                      Oluşturulacak klasörler
                    </p>
                    <ol className="border-border bg-muted/30 max-h-40 overflow-y-auto rounded-lg border">
                      {templateSeedMissingPathsPreview!.map((p, idx) => (
                        <li
                          key={p}
                          className="border-border/50 flex items-center gap-2.5 border-b px-3 py-1.5 last:border-b-0">
                          <span className="text-muted-foreground/50 w-4 shrink-0 text-right font-mono text-[10px]">
                            {idx + 1}
                          </span>
                          <span className="min-w-0 truncate font-mono text-[11px]" title={p}>
                            {p}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
              </div>
            </DialogDescription>
          </DialogHeader>
        </div>
        <DialogFooter className="border-border gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            className="rounded-xl"
            onClick={onDecline}
            disabled={pending}>
            İptal
          </Button>
          <Button
            type="button"
            variant="default"
            className="rounded-xl"
            onClick={handleConfirm}
            disabled={!projectId || pending}>
            {pending ? 'Oluşturuluyor…' : 'Evet, oluştur'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
