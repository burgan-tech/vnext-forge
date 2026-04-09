import { FolderOpen } from 'lucide-react';

import { FolderBrowser } from '@entities/workspace/ui/folder-browser';
import { Alert, AlertDescription } from '@shared/ui/alert';
import { Button } from '@shared/ui/button';
import {
  Dialog,
  DialogCancelButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/ui/dialog';

import { useImportProject } from '../model/useImportProject';

type ImportProjectCallback = (
  project: import('@entities/project/model/types').ProjectInfo,
) => Promise<void> | void;

interface ImportProjectDialogProps {
  onImported?: ImportProjectCallback;
}

export function ImportProjectDialog({ onImported }: ImportProjectDialogProps) {
  const importProject = useImportProject({ onImported });

  return (
    <>
      <Button
        variant="default"
        leftIconVariant="secondary"
        leftIcon={<FolderOpen size={20} />}
        onClick={() => {
          void importProject.openDialog();
        }}
        className="w-full justify-start gap-4 rounded-[28px] text-left shadow-sm">
        <div className="flex-1">
          <div className="text-foreground text-sm font-semibold">Import Project</div>
          <div className="text-muted-foreground text-xs">
            Browse and link an existing vnext project
          </div>
        </div>
      </Button>

      <Dialog open={importProject.open} onOpenChange={importProject.setOpen}>
        <DialogContent className="border-border bg-surface max-w-xl rounded-[28px] p-0">
          <div className="space-y-5 p-6">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle>Import Project</DialogTitle>
              <DialogDescription>
                Browse the workspace and select an existing project folder to link.
              </DialogDescription>
            </DialogHeader>

            <FolderBrowser
              currentPath={importProject.browsePath}
              folders={importProject.folders}
              selectedPath={importProject.selectedPath}
              placeholder="Select an existing vnext project folder"
              inline
              open={true}
              onToggle={() => {
                void importProject.browse(importProject.browsePath || undefined);
              }}
              onNavigate={(path) => {
                void importProject.browse(path);
              }}
              onSelect={(path) => {
                importProject.setSelectedPath(path);
              }}
            />

            {importProject.browseError ? (
              <Alert variant="destructive" className="rounded-xl px-3 py-2 text-xs">
                <AlertDescription>
                  {importProject.browseError.toUserMessage().message}
                </AlertDescription>
              </Alert>
            ) : null}

            {importProject.importError ? (
              <Alert variant="destructive" className="rounded-xl px-3 py-2 text-xs">
                <AlertDescription>
                  {importProject.importError.toUserMessage().message}
                </AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter>
              <DialogCancelButton
                variant="destructive"
                onClick={() => importProject.setOpen(false)}
                className="rounded-xl">
                Cancel
              </DialogCancelButton>
              <Button
                variant="default"
                onClick={() => {
                  void importProject.submit();
                }}
                loading={importProject.importing}
                disabled={!importProject.selectedPath}
                className="rounded-xl">
                Import
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
