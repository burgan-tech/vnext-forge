import { useCallback, useEffect, useId, useRef, useState } from 'react';

import {
  normalizeWorkspaceName,
  showNotification,
  getVnextComponentJsonFileNameError,
  getWorkspaceNameError,
  type VnextComponentType,
} from '@vnext-forge-studio/designer-ui';
import {
  Button,
  Dialog,
  DialogCancelButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from '@vnext-forge-studio/designer-ui/ui';

import { useProjectListStore } from '../../app/store/useProjectListStore';

import type { RunVnextComponentResult } from './hooks/useProjectWorkspace';

const COMPONENT_TITLE: Record<VnextComponentType, string> = {
  workflow: 'Workflow',
  task: 'Task',
  function: 'Function',
  extension: 'Extension',
  schema: 'Schema',
  view: 'View',
};

const SUCCESS_COPY: Record<VnextComponentType, string> = {
  workflow: 'Workflow created.',
  task: 'Task created.',
  function: 'Function created.',
  extension: 'Extension created.',
  schema: 'Schema created.',
  view: 'View created.',
};

function folderPathForDisplay(absolute: string, projectRoot: string): string {
  const a = absolute.replace(/\\/g, '/').replace(/\/+$/, '');
  const p = projectRoot.replace(/\\/g, '/').replace(/\/+$/, '');
  const lowerA = a.toLowerCase();
  const lowerP = p.toLowerCase();
  if (lowerA === lowerP) {
    return '.';
  }
  if (lowerA.startsWith(`${lowerP}/`)) {
    return a.slice(p.length + 1);
  }
  return absolute;
}

function validateName(raw: string, kind: VnextComponentType): string | null {
  if (kind === 'workflow') {
    return getWorkspaceNameError(raw, 'workflow');
  }
  return getVnextComponentJsonFileNameError(raw);
}

export interface NewVnextComponentDialogState {
  kind: VnextComponentType;
  parentPath: string;
}

interface NewVnextComponentFromTreeDialogProps {
  open: boolean;
  state: NewVnextComponentDialogState | null;
  projectRoot: string;
  onOpenChange: (open: boolean) => void;
  runVnextComponentOnly: (
    parentPath: string,
    name: string,
    kind: VnextComponentType,
    options?: { suppressNotifications?: boolean },
  ) => Promise<RunVnextComponentResult>;
}

export function NewVnextComponentFromTreeDialog({
  open,
  state,
  projectRoot,
  onOpenChange,
  runVnextComponentOnly,
}: NewVnextComponentFromTreeDialogProps) {
  const nameId = useId();
  const statusId = useId();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const refreshFileTree = useProjectListStore((s) => s.refreshFileTree);

  useEffect(() => {
    if (!open || !state) {
      return;
    }
    const id = requestAnimationFrame(() => {
      nameInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open, state]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSubmit = useCallback(async () => {
    if (!state || submitting) {
      return;
    }
    const trimmed = name.trim();
    const v = validateName(trimmed, state.kind);
    if (v) {
      setFieldError(v);
      setSubmitError(null);
      setAnnounce(v);
      return;
    }

    const wireName =
      state.kind === 'workflow' ? normalizeWorkspaceName(trimmed, 'workflow') : trimmed;

    setSubmitting(true);
    setFieldError(null);
    setSubmitError(null);
    setAnnounce('Creating...');

    const result = await runVnextComponentOnly(state.parentPath, wireName, state.kind, {
      suppressNotifications: true,
    });

    setSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.message);
      setAnnounce(result.message);
      return;
    }

    const successMsg = SUCCESS_COPY[state.kind];
    showNotification({ message: successMsg, kind: 'success' });
    setAnnounce(successMsg);
    void refreshFileTree();
    handleClose();
  }, [state, name, submitting, runVnextComponentOnly, refreshFileTree, handleClose]);

  if (!state) {
    return <Dialog open={false} onOpenChange={onOpenChange} />;
  }

  const kindTitle = COMPONENT_TITLE[state.kind];
  const placeholder =
    state.kind === 'workflow' ? 'e.g. MyWorkflow' : 'e.g. NotifyCustomer';
  const displayPath = folderPathForDisplay(state.parentPath, projectRoot);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="border-border bg-surface max-h-[calc(100vh-4rem)] max-w-[min(560px,calc(100vw-2rem))] gap-0 overflow-hidden rounded-[28px] p-0 sm:max-w-[560px]">
        <DialogHeader className="border-0 border-b-0 px-6 pb-2 pt-6 text-left">
          <DialogTitle>New {kindTitle}</DialogTitle>
        </DialogHeader>

        <div className="text-muted-foreground px-6 pb-3 text-sm">
          <span className="text-foreground/80 font-medium">Target folder: </span>
          <span className="break-all font-mono text-xs">{displayPath}</span>
        </div>

        <div className="px-6 pb-4">
          <Label htmlFor={nameId} className="text-foreground mb-1.5 block text-sm font-medium">
            Name
          </Label>
          <input
            id={nameId}
            ref={nameInputRef}
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder={placeholder}
            value={name}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError || submitError ? `${statusId}` : undefined}
            disabled={submitting}
            onChange={(e) => {
              setName(e.target.value);
              if (fieldError) setFieldError(null);
              if (submitError) setSubmitError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            className="border-primary-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary h-10 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60"
          />
          {fieldError ? (
            <p className="text-destructive-text mt-2 text-xs" role="alert">
              {fieldError}
            </p>
          ) : null}
          {submitError ? (
            <p className="text-destructive-text mt-2 text-xs" role="alert">
              {submitError}
            </p>
          ) : null}
        </div>

        <span id={statusId} className="sr-only" aria-live="polite">
          {announce}
        </span>

        <DialogFooter className="border-border/60 bg-surface/95 border-t px-6 py-4 backdrop-blur">
          <DialogCancelButton
            variant="secondary"
            disabled={submitting}
            onClick={handleClose}
            className="rounded-xl">
            Cancel
          </DialogCancelButton>
          <Button
            variant="default"
            loading={submitting}
            onClick={() => {
              void handleSubmit();
            }}
            className="rounded-xl">
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
