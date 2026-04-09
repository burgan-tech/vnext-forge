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
        leftIcon={<FolderOpen size={20} />}
        onClick={() => {
          void importProject.openDialog();
        }}
        className="group border-border/80 bg-surface hover:border-primary-border-hover hover:shadow-primary/5 flex w-full justify-start gap-4 rounded-[28px] border text-left transition-all duration-200 hover:shadow-lg">
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
              <p className="text-error-foreground text-xs">
                {importProject.browseError.toUserMessage().message}
              </p>
            ) : null}

            {importProject.importError ? (
              <p className="text-error-foreground text-xs">
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
                className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-xl">
                Import
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
