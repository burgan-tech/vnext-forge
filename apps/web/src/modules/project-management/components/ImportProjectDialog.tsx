import { FolderOpen } from 'lucide-react';

import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogCancelButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@vnext-forge/designer-ui/ui';

import { FolderBrowser } from './FolderBrowser';
import { useImportProject } from '../hooks/useImportProject';
import type { ProjectInfo } from '../ProjectTypes';

type ImportProjectCallback = (project: ProjectInfo) => Promise<void> | void;

interface ImportProjectDialogProps {
  onImported?: ImportProjectCallback;
  disabled?: boolean;
}

export function ImportProjectDialog({ onImported, disabled }: ImportProjectDialogProps) {
  const importProject = useImportProject({ onImported });

  return (
    <>
      <Button
        variant="default"
        leftIconVariant="secondary"
        leftIconComponent={
          <div className="border-info-border bg-info-surface text-info-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all duration-200 ease-out group-hover/button:border-info-border-hover group-hover/button:bg-info-hover group-hover/button:-translate-y-px group-hover/button:shadow-sm">
            <FolderOpen className="size-4" aria-hidden="true" />
          </div>
        }
        disabled={disabled}
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
                variant="secondary"
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
