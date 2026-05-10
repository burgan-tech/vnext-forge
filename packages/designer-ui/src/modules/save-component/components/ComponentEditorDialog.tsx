import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { useComponentStore } from '../../../store/useComponentStore.js';
import { useSchemaEditorStore } from '../../schema-editor/useSchemaEditorStore.js';
import { ConfirmAlertDialog } from '../../../ui/AlertDialog.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../../ui/Dialog.js';
import { TaskEditorView } from '../../task-editor/TaskEditorView.js';
import { SchemaEditorView } from '../../schema-editor/SchemaEditorView.js';
import { ViewEditorView } from '../../view-editor/ViewEditorView.js';
import { FunctionEditorView } from '../../function-editor/FunctionEditorView.js';
import { ExtensionEditorView } from '../../extension-editor/ExtensionEditorView.js';
import type { ComponentEditorTarget } from '../componentEditorModalTypes.js';

function isAtomicEditorDirty(kind: ComponentEditorTarget['kind']): boolean {
  if (kind === 'schema') {
    return useSchemaEditorStore.getState().isDirty;
  }
  return useComponentStore.getState().isDirty;
}

export interface ComponentEditorDialogHostProps {
  open: boolean;
  target: ComponentEditorTarget | null;
  onCloseRequest: () => void;
  onOpenScriptFileInHost?: (absolutePath: string) => void;
}

const KIND_LABEL: Record<ComponentEditorTarget['kind'], string> = {
  task: 'Task',
  schema: 'Schema',
  view: 'View',
  function: 'Function',
  extension: 'Extension',
};

/** Atomic editor in a Radix dialog; toolbar is hoisted to the header via `registerToolbar`. */
export function ComponentEditorDialog({
  open,
  target,
  onCloseRequest,
  onOpenScriptFileInHost,
}: ComponentEditorDialogHostProps) {
  const [toolbar, setToolbar] = useState<ReactNode | null>(null);
  const [unsavedClosePromptOpen, setUnsavedClosePromptOpen] = useState(false);

  useEffect(() => {
    if (!open) setToolbar(null);
  }, [open]);

  useEffect(() => {
    if (!open) setUnsavedClosePromptOpen(false);
  }, [open]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) return;
      if (target && isAtomicEditorDirty(target.kind)) {
        setUnsavedClosePromptOpen(true);
        return;
      }
      onCloseRequest();
    },
    [onCloseRequest, target],
  );

  const handleConfirmCloseWithoutSave = useCallback(() => {
    setUnsavedClosePromptOpen(false);
    onCloseRequest();
  }, [onCloseRequest]);

  if (!open || !target) return null;

  const title = `${target.group}/${target.name}.json`;

  const editorKey = `${target.kind}-${target.projectId}-${target.group}-${target.name}`;

  const body = (() => {
    const common = {
      projectId: target.projectId,
      group: target.group,
      name: target.name,
      registerToolbar: setToolbar,
      layoutSurface: 'modal' as const,
      onAtomicSaved: target.onAtomicSaved,
    };
    switch (target.kind) {
      case 'task':
        return (
          <TaskEditorView
            key={editorKey}
            {...common}
          />
        );
      case 'schema':
        return <SchemaEditorView key={editorKey} {...common} />;
      case 'view':
        return <ViewEditorView key={editorKey} {...common} />;
      case 'function':
        return <FunctionEditorView key={editorKey} {...common} />;
      case 'extension':
        return <ExtensionEditorView key={editorKey} {...common} />;
      default:
        return null;
    }
  })();

  return (
    <>
      <ConfirmAlertDialog
        open={unsavedClosePromptOpen}
        onOpenChange={setUnsavedClosePromptOpen}
        tone="warning"
        title="Unsaved changes"
        description="You have unsaved changes. Close the editor without saving? Your changes will be lost."
        cancelLabel="Keep editing"
        confirmLabel="Close without saving"
        onConfirm={handleConfirmCloseWithoutSave}
      />
      <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        variant="secondary"
        showCloseButton
        closeInHeader
        closeButtonHoverable
        hoverable={false}
        enableResize
        resizeStorageKey="vnext-forge.dialog.component-editor"
        resizeDefaultWidth={1100}
        resizeDefaultHeight={800}
        className="border-border bg-background text-foreground flex max-w-none! flex-col gap-0 overflow-hidden p-0 shadow-lg">
        <DialogHeader
          data-dialog-handle="drag"
          style={{ cursor: 'move' }}
          className="bg-muted/30 shrink-0 select-none gap-0 border-b px-4 py-3">
          <div className="flex min-w-0 flex-col gap-2 pr-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:pr-6">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-foreground truncate text-left text-base font-semibold">
                {title}
              </DialogTitle>
              <div className="text-muted-foreground mt-0.5 text-[11px] font-medium">
                {KIND_LABEL[target.kind]} editor
              </div>
            </div>
            {toolbar ? (
              <div className="ml-auto flex min-w-0 shrink-0 items-center justify-end sm:ml-0">
                {toolbar}
              </div>
            ) : null}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
      </DialogContent>
    </Dialog>
    </>
  );
}
