import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/ui/Dialog';
import { Button } from '@shared/ui/Button';
import { showNotification } from '@shared/notification/model/NotificationStore';
import { useProjectStore } from '@app/store/useProjectStore';
import { useVnextWorkspaceUiStore } from '@app/store/useVnextWorkspaceUiStore';
import { seedVnextComponentLayout } from '@modules/project-management/ProjectApi';
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

  const title =
    templateSeedDialogReason === 'only_config'
      ? 'Şablon klasörleri oluşturulsun mu?'
      : templateSeedDialogReason === 'incomplete_layout'
        ? 'Eksik bileşen klasörleri tamamlansın mı?'
        : 'Şablon proje oluşturulsun mu?';

  const handleConfirm = () => {
    void (async () => {
      setPending(true);
      try {
        const { ensuredPaths } = await seedVnextComponentLayout(projectId);
        onOpenChange(false);
        void useProjectStore.getState().refreshFileTree();
        showNotification({
          type: 'success',
          message:
            ensuredPaths.length > 0
              ? `Bileşen klasörleri oluşturuldu veya doğrulandı (Toplamda olması gereken ${ensuredPaths.length} yol doğrulandı.).`
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
        <div className="space-y-3 px-6 py-5">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="text-muted-foreground space-y-2 leading-relaxed">
              {templateSeedDialogReason === 'only_config' ? (
                <p>
                  Proje kökünde yalnızca{' '}
                  <span className="font-mono text-xs">vnext.config.json</span> görünüyor.
                  Yapılandırmadaki <span className="font-mono text-xs">paths.componentsRoot</span>{' '}
                  altında Tasks, Views, Workflows vb. klasör iskeletini oluşturmak ister misiniz?
                </p>
              ) : templateSeedDialogReason === 'incomplete_layout' ? (
                <p>
                  <span className="font-mono text-xs">vnext.config.json</span> yollarına göre bazı
                  bileşen klasörleri eksik veya dosya olarak mevcut. Eksikleri oluşturmak (mevcut
                  klasörlere dokunmadan) ister misiniz?
                </p>
              ) : (
                <p>
                  <span className="font-mono text-xs">vnext.config.json</span> içindeki{' '}
                  <span className="font-mono text-xs">paths.componentsRoot</span> ve bileşen
                  yollarına göre eksik klasörleri sunucuda oluşturur.
                </p>
              )}
              {templateSeedDialogReason === 'incomplete_layout' &&
              templateSeedMissingPathsPreview &&
              templateSeedMissingPathsPreview.length > 0 ? (
                <ul className="border-border bg-muted/40 max-h-32 list-inside list-disc overflow-y-auto rounded-lg border px-3 py-2 font-mono text-[11px]">
                  {templateSeedMissingPathsPreview.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : null}
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
            Hayır
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
