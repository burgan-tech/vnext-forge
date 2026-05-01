import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';

import { isFailure, type DiscoveredVnextComponent, type VnextExportCategory } from '@vnext-forge/app-contracts';
import { saveComponentFile } from '../../../../save-component/SaveComponentApi.js';
import { useProjectStore } from '../../../../../store/useProjectStore.js';
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

const CATEGORY_META: Record<
  string,
  { singular: string; flow: string; template: (key: string, domain: string) => Record<string, unknown> }
> = {
  schemas: {
    singular: 'schema',
    flow: 'sys-schemas',
    template: (key, domain) => ({
      key,
      version: '1.0.0',
      domain,
      flow: 'sys-schemas',
      attributes: {},
    }),
  },
  views: {
    singular: 'view',
    flow: 'sys-views',
    template: (key, domain) => ({
      key,
      version: '1.0.0',
      domain,
      flow: 'sys-views',
      attributes: {
        display: 'full-page',
        content: {},
      },
    }),
  },
  extensions: {
    singular: 'extension',
    flow: 'sys-extensions',
    template: (key, domain) => ({
      key,
      version: '1.0.0',
      domain,
      flow: 'sys-extensions',
      attributes: {},
    }),
  },
  functions: {
    singular: 'function',
    flow: 'sys-functions',
    template: (key, domain) => ({
      key,
      version: '1.0.0',
      domain,
      flow: 'sys-functions',
      attributes: {},
    }),
  },
};

type SupportedCategory = 'schemas' | 'views' | 'extensions' | 'functions';

export interface CreateNewComponentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (created: DiscoveredVnextComponent) => void;
  category: SupportedCategory;
}

export function CreateNewComponentDialog({
  open,
  onOpenChange,
  onCreated,
  category,
}: CreateNewComponentDialogProps) {
  const activeProject = useProjectStore((s) => s.activeProject);
  const vnextConfig = useProjectStore((s) => s.vnextConfig);
  const projectDomain = vnextConfig?.domain ?? activeProject?.domain ?? '';

  const meta = CATEGORY_META[category];

  const [folderInput, setFolderInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [items, setItems] = useState<DiscoveredVnextComponent[]>([]);

  const categoryFolder = vnextConfig?.paths?.[category] ?? '';

  const load = useCallback(async () => {
    if (!activeProject) {
      setItems([]);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const list = await discoverVnextComponentsByCategory(
        activeProject.id,
        category as VnextExportCategory,
      );
      setItems(list);
    } catch {
      setLoadError(`Could not list ${meta.singular} files.`);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeProject, category, meta.singular]);

  useEffect(() => {
    if (!open) return;
    setFolderInput('');
    setNameInput('');
    if (activeProject) void load();
    else {
      setItems([]);
      setLoadError(null);
    }
  }, [open, activeProject, load]);

  const folderSlug = useMemo(() => toKebabSlug(folderInput), [folderInput]);
  const componentName = useMemo(() => toKebabSlug(nameInput), [nameInput]);

  const targetPath = useMemo(() => {
    if (!activeProject || !vnextConfig || !folderSlug || !componentName) return null;
    return buildAtomicComponentJsonPath(
      activeProject.path,
      vnextConfig.paths,
      category,
      folderSlug,
      componentName,
    );
  }, [activeProject, folderSlug, componentName, vnextConfig, category]);

  const pathCollision = useMemo(() => {
    if (!targetPath) return false;
    const t = normPath(targetPath).toLowerCase();
    return items.some((i) => normPath(i.path).toLowerCase() === t);
  }, [items, targetPath]);

  const canSubmit =
    Boolean(
      activeProject &&
        vnextConfig &&
        folderSlug &&
        componentName &&
        KEBAB.test(folderSlug) &&
        KEBAB.test(componentName),
    ) && !pathCollision;

  const handleCreate = async () => {
    if (!canSubmit || !activeProject || !vnextConfig || !targetPath) return;
    const json = meta.template(componentName, projectDomain);
    try {
      const res = await saveComponentFile(targetPath, JSON.stringify(json, null, 2));
      if (isFailure(res)) {
        showNotification({
          kind: 'error',
          message: res.error.message?.trim() || `Could not create ${meta.singular} file.`,
        });
        return;
      }
      onCreated({
        key: componentName,
        path: targetPath,
        flow: meta.flow,
        version: '1.0.0',
      });
      onOpenChange(false);
      showNotification({ kind: 'success', message: `${capitalize(meta.singular)} file created.` });
    } catch {
      showNotification({ kind: 'error', message: `Could not create ${meta.singular} file.` });
    }
  };

  const previewRel =
    vnextConfig && targetPath && activeProject
      ? normPath(targetPath)
          .replace(normPath(activeProject.path).replace(/\/$/, ''), '')
          .replace(/^\//, '')
      : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        variant="secondary"
        className="border-border bg-surface text-foreground max-h-[min(88vh,560px)] max-w-md gap-0 p-0 shadow-sm"
        showCloseButton
        closeButtonHoverable
        hoverable={false}>
        <DialogHeader>
          <DialogTitle className="text-foreground pr-3 text-base font-semibold tracking-tight sm:pr-4">
            Create new {meta.singular}
          </DialogTitle>
        </DialogHeader>

        <DialogDescription className="text-muted-foreground px-4 text-xs leading-relaxed">
          Choose a folder under{' '}
          <span className="font-mono">{categoryFolder || capitalize(category)}</span> and a
          kebab-case file name. A minimal {meta.singular} JSON will be written to disk.
        </DialogDescription>

        <div className="flex min-h-0 flex-col gap-3 px-4 pb-4">
          {loading && (
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Loader2
                className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
                aria-hidden
              />
              Scanning {category}…
            </div>
          )}
          {loadError && <div className="text-destructive-text text-xs">{loadError}</div>}

          <div className="space-y-1">
            <label
              className="text-muted-foreground text-[10px] font-semibold"
              htmlFor={`vnext-new-${category}-folder`}>
              Folder
            </label>
            <Input
              id={`vnext-new-${category}-folder`}
              value={folderInput}
              onChange={(e) => setFolderInput(e.target.value)}
              placeholder="e.g. my-folder"
              autoComplete="off"
              disabled={!activeProject}
              variant="muted"
              size="sm"
            />
            {folderSlug && !KEBAB.test(folderSlug) ? (
              <p className="text-destructive-text text-[10px]">
                Use lowercase letters, numbers, and hyphens only.
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label
              className="text-muted-foreground text-[10px] font-semibold"
              htmlFor={`vnext-new-${category}-name`}>
              {capitalize(meta.singular)} name (file key)
            </label>
            <Input
              id={`vnext-new-${category}-name`}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder={`e.g. my-${meta.singular}`}
              autoComplete="off"
              disabled={!activeProject}
              variant="muted"
              size="sm"
            />
            {componentName && !KEBAB.test(componentName) ? (
              <p className="text-destructive-text text-[10px]">
                Use lowercase letters, numbers, and hyphens only.
              </p>
            ) : null}
          </div>

          {previewRel ? (
            <p
              className="text-muted-foreground font-mono text-[10px] break-all"
              title={targetPath ?? undefined}>
              {previewRel}
            </p>
          ) : null}
          {pathCollision ? (
            <p className="text-destructive-text text-xs">
              A {meta.singular} file already exists at this path.
            </p>
          ) : null}

          <div className="mt-1 mr-3 flex justify-end gap-2 sm:mr-4">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onOpenChange(false)}>
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

export function CreateNewComponentButton({
  category,
  onClick,
  disabled,
}: {
  category: SupportedCategory;
  onClick: () => void;
  disabled?: boolean;
}) {
  const meta = CATEGORY_META[category];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`Create a new ${meta.singular} JSON under ${capitalize(category)}/`}
      className="text-secondary-icon hover:text-secondary-foreground inline-flex min-h-0 cursor-pointer items-center gap-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45">
      <Plus className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
      Create new {meta.singular}
    </button>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
