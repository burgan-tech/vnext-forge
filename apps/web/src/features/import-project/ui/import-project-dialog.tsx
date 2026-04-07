import { FolderOpen } from 'lucide-react';

import { FolderBrowser } from '@entities/workspace/ui/folder-browser';
import { Button } from '@shared/ui/button';
import {
  Dialog,
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
        leftIcon={
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-muted text-primary transition-colors group-hover:bg-primary-muted-hover">
            <FolderOpen size={20} />
          </div>
        }
        onClick={() => {
          void importProject.openDialog();
        }}
        className="group flex w-full justify-start gap-4 rounded-[28px] border border-border/80 bg-surface text-left transition-all duration-200 hover:border-primary-border-hover hover:shadow-lg hover:shadow-primary/5">
        <div className="flex-1">
          <div className="text-sm font-semibold text-foreground">Import Project</div>
          <div className="text-xs text-muted-foreground">Browse and link an existing vnext project</div>
        </div>
      </Button>

      <Dialog open={importProject.open} onOpenChange={importProject.setOpen}>
        <DialogContent className="max-w-xl rounded-[28px] border-border bg-surface p-0">
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
              <p className="text-xs text-error-foreground">
                {importProject.browseError.toUserMessage().message}
              </p>
            ) : null}

            {importProject.importError ? (
              <p className="text-xs text-error-foreground">
                {importProject.importError.toUserMessage().message}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => importProject.setOpen(false)}
                className="rounded-xl">
                Cancel
              </Button>
              <Button
                onClick={() => {
                  void importProject.submit();
                }}
                loading={importProject.importing}
                disabled={!importProject.selectedPath}
                className="rounded-xl bg-primary text-primary-foreground hover:bg-primary-hover">
                Import
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
