import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';

import { isFailure, type DiscoveredVnextComponent } from '@vnext-forge/app-contracts';
import { saveComponentFile } from '../../../../save-component/SaveComponentApi.js';
import { useProjectStore } from '../../../../../store/useProjectStore.js';
import { groupDiscoveredTasksForPicker } from '../../../../task-editor/groupCsxScriptsForTaskPicker.js';
import { buildAtomicComponentJsonPath } from '../../../../vnext-workspace/atomicComponentPaths.js';
import { discoverVnextComponentsByCategory } from '../../../../vnext-workspace/vnextComponentDiscovery.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../../ui/Dialog.js';
import { Input } from '../../../../../ui/Input.js';
import { Button } from '../../../../../ui/Button.js';
import { showNotification } from '../../../../../notification/notification-port.js';

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function toKebabSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
}

export interface CreateNewTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (created: DiscoveredVnextComponent) => void;
}

/**
 * Create `Tasks/<subdomain>/<name>.json` with a minimal script-task template.
 * Parent adds the result to the workflow; user opens the editor from the card.
 */
export function CreateNewTaskDialog({ open, onOpenChange, onCreated }: CreateNewTaskDialogProps) {
  const activeProject = useProjectStore((s) => s.activeProject);
  const vnextConfig = useProjectStore((s) => s.vnextConfig);
  const projectDomain = vnextConfig?.domain ?? activeProject?.domain ?? '';

  const [subdomainInput, setSubdomainInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [items, setItems] = useState<DiscoveredVnextComponent[]>([]);

  const tasksFolder = vnextConfig?.paths.tasks ?? '';

  const subdomains = useMemo(() => {
    if (!activeProject || !vnextConfig?.paths) return [] as string[];
    const rows = groupDiscoveredTasksForPicker(items, activeProject.path, vnextConfig.paths);
    const set = new Set<string>();
    for (const row of rows) {
      if (row.category === tasksFolder && row.subgroup) {
        set.add(row.subgroup);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [activeProject, items, tasksFolder, vnextConfig?.paths]);

  const load = useCallback(async () => {
    if (!activeProject) {
      setItems([]);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const list = await discoverVnextComponentsByCategory(activeProject.id, 'tasks');
      setItems(list);
    } catch {
      setLoadError('Could not list tasks.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeProject]);

  useEffect(() => {
    if (!open) return;
    setSubdomainInput('');
    setNameInput('');
    if (activeProject) void load();
    else {
      setItems([]);
      setLoadError(null);
    }
  }, [open, activeProject, load]);

  const subdomain = useMemo(() => toKebabSlug(subdomainInput), [subdomainInput]);
  const taskName = useMemo(() => toKebabSlug(nameInput), [nameInput]);

  const targetPath = useMemo(() => {
    if (!activeProject || !vnextConfig || !subdomain || !taskName) return null;
    return buildAtomicComponentJsonPath(activeProject.path, vnextConfig.paths, 'tasks', subdomain, taskName);
  }, [activeProject, subdomain, taskName, vnextConfig]);

  const pathCollision = useMemo(() => {
    if (!targetPath) return false;
    const t = normPath(targetPath).toLowerCase();
    return items.some((i) => normPath(i.path).toLowerCase() === t);
  }, [items, targetPath]);

  const canSubmit =
    Boolean(activeProject && vnextConfig && subdomain && taskName && KEBAB.test(subdomain) && KEBAB.test(taskName)) &&
    !pathCollision;

  const handleCreate = async () => {
    if (!canSubmit || !activeProject || !vnextConfig || !targetPath) return;
    const json: Record<string, unknown> = {
      key: taskName,
      version: '1.0.0',
      domain: projectDomain,
      flow: 'sys-tasks',
      flowVersion: '1.0.0',
      tags: [] as string[],
      attributes: {
        type: '7',
        config: {} as Record<string, unknown>,
      },
    };
    try {
      const res = await saveComponentFile(targetPath, JSON.stringify(json, null, 2));
      if (isFailure(res)) {
        showNotification({
          kind: 'error',
          message: res.error.message?.trim() || 'Could not create task file.',
        });
        return;
      }
      onCreated({
        key: taskName,
        path: targetPath,
        flow: 'sys-tasks',
        version: '1.0.0',
      });
      onOpenChange(false);
      showNotification({ kind: 'success', message: 'Task file created.' });
    } catch {
      showNotification({ kind: 'error', message: 'Could not create task file.' });
    }
  };

  const previewRel =
    vnextConfig && targetPath && activeProject
      ? normPath(targetPath)
          .replace(
            normPath(activeProject.path).replace(/\/$/, ''),
            '',
          )
          .replace(/^\//, '')
      : '';

  const datalistId = 'vnext-create-task-subdomains';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        variant="secondary"
        className="border-border bg-surface text-foreground max-h-[min(88vh,560px)] max-w-md gap-0 p-0 shadow-sm"
        showCloseButton
        closeButtonHoverable
        hoverable={false}>
        <DialogHeader>
          <DialogTitle className="text-foreground text-base font-semibold tracking-tight">
            Create new task
          </DialogTitle>
        </DialogHeader>

        <DialogDescription className="text-muted-foreground px-4 text-xs leading-relaxed">
          Choose a subdomain folder under <span className="font-mono">{tasksFolder || 'Tasks'}</span> and a kebab-case
          file name. A minimal script task JSON will be written to disk.
        </DialogDescription>

        <div className="flex min-h-0 flex-col gap-3 px-4 pb-4">
          {loading && (
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Loader2 className="size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
              Scanning tasks…
            </div>
          )}
          {loadError && <div className="text-destructive-text text-xs">{loadError}</div>}

          <div className="space-y-1">
            <label className="text-muted-foreground text-[10px] font-semibold" htmlFor="vnext-new-task-sub">
              Subdomain
            </label>
            <Input
              id="vnext-new-task-sub"
              value={subdomainInput}
              onChange={(e) => setSubdomainInput(e.target.value)}
              list={datalistId}
              placeholder="e.g. account-opening"
              autoComplete="off"
              disabled={!activeProject}
              variant="muted"
              size="sm"
            />
            <datalist id={datalistId}>
              {subdomains.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            {subdomain && !KEBAB.test(subdomain) ? (
              <p className="text-destructive-text text-[10px]">Use lowercase letters, numbers, and hyphens only.</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label className="text-muted-foreground text-[10px] font-semibold" htmlFor="vnext-new-task-name">
              Task name (file key)
            </label>
            <Input
              id="vnext-new-task-name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. my-script-task"
              autoComplete="off"
              disabled={!activeProject}
              variant="muted"
              size="sm"
            />
            {taskName && !KEBAB.test(taskName) ? (
              <p className="text-destructive-text text-[10px]">Use lowercase letters, numbers, and hyphens only.</p>
            ) : null}
          </div>

          {previewRel ? (
            <p className="text-muted-foreground font-mono text-[10px] break-all" title={targetPath ?? undefined}>
              {previewRel}
            </p>
          ) : null}
          {pathCollision ? (
            <p className="text-destructive-text text-xs">A task file already exists at this path.</p>
          ) : null}

          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleCreate()}
              disabled={!canSubmit || loading}>
              Create
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CreateNewTaskButton({
  onClick,
  disabled,
  title = 'Create a new task JSON under Tasks/<subdomain>/',
  label = 'Create new task',
}: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="text-secondary-icon hover:text-secondary-foreground inline-flex min-h-0 cursor-pointer items-center gap-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45">
      <Plus className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
      {label}
    </button>
  );
}
