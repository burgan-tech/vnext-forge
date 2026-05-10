import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';

import type { DiscoveredVnextComponent, VnextExportCategory } from '@vnext-forge-studio/app-contracts';
import { ComponentFileIcon } from '../../../../../modules/component-icons/ComponentFileIcon.js';
import { groupDiscoveredTasksForPicker } from '../../../../task-editor/groupCsxScriptsForTaskPicker.js';
import { useProjectStore } from '../../../../../store/useProjectStore.js';
import type { VnextComponentType } from '../../../../../shared/projectTypes.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../../ui/Dialog.js';
import { Input } from '../../../../../ui/Input.js';

import { discoverVnextComponentsByCategory } from '../../../../vnext-workspace/vnextComponentDiscovery.js';

const CATEGORY_TO_ICON: Record<VnextExportCategory, VnextComponentType> = {
  workflows: 'workflow',
  tasks: 'task',
  schemas: 'schema',
  views: 'view',
  functions: 'function',
  extensions: 'extension',
};

const CATEGORY_LABEL: Record<VnextExportCategory, { singular: string; plural: string }> = {
  workflows: { singular: 'workflow', plural: 'workflows' },
  tasks: { singular: 'task', plural: 'tasks' },
  schemas: { singular: 'schema', plural: 'schemas' },
  views: { singular: 'view', plural: 'views' },
  functions: { singular: 'function', plural: 'functions' },
  extensions: { singular: 'extension', plural: 'extensions' },
};

export interface ChooseExistingVnextComponentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Hangi vNext `flow`/export kategorisindeki JSON bileşenleri listelenecek. */
  category: VnextExportCategory;
  onSelect: (component: DiscoveredVnextComponent) => void;
  /** Varsayılan: `Choose a {singular}` */
  title?: string;
  /** Varsayılan: kısa açıklama (JSON key, flow, yollar) */
  description?: string;
}

/**
 * vnext.config yollarındaki seçilen kategorideki (ör. `sys-tasks`, `sys-flows`) JSON bileşenlerini listeler;
 * tek tıkla seçim. Grup düzeni, task picker ile aynı `paths` hiyerarşisine dayanır.
 */
export function ChooseExistingVnextComponentDialog({
  open,
  onOpenChange,
  category,
  onSelect,
  title: titleOverride,
  description: descriptionOverride,
}: ChooseExistingVnextComponentDialogProps) {
  const activeProject = useProjectStore((s) => s.activeProject);
  const vnextConfig = useProjectStore((s) => s.vnextConfig);
  const [listQuery, setListQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<DiscoveredVnextComponent[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const labels = CATEGORY_LABEL[category];
  const iconType = CATEGORY_TO_ICON[category];
  const defaultTitle = `Choose a ${labels.singular}`;
  const title = titleOverride ?? defaultTitle;
  const defaultDescription = `Select a ${labels.singular} JSON from your workspace paths. Key, version, and flow come from the file; domain uses the current vnext config.`;
  const description = descriptionOverride ?? defaultDescription;

  const canLoad = Boolean(activeProject);

  const load = useCallback(async () => {
    if (!activeProject) {
      setItems([]);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const list = await discoverVnextComponentsByCategory(activeProject.id, category);
      setItems(list);
    } catch {
      setLoadError(
        `${labels.singular.charAt(0).toUpperCase() + labels.singular.slice(1)} list could not be loaded.`,
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeProject, category, labels.singular]);

  useEffect(() => {
    if (!open) return;
    setListQuery('');
    if (canLoad) void load();
    else {
      setItems([]);
      setLoadError(null);
    }
  }, [open, canLoad, load]);

  const filtered = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((t) => t.key.toLowerCase().includes(q));
  }, [items, listQuery]);

  const groupedPickRows = useMemo(
    () => groupDiscoveredTasksForPicker(filtered, activeProject?.path ?? '', vnextConfig?.paths ?? null),
    [filtered, activeProject?.path, vnextConfig?.paths],
  );

  const isFlatPicker =
    groupedPickRows.length === 1 &&
    groupedPickRows[0] != null &&
    groupedPickRows[0].category === '' &&
    groupedPickRows[0].subgroup === '';

  const handlePick = (row: DiscoveredVnextComponent) => {
    onSelect(row);
    onOpenChange(false);
  };

  const listboxLabel = `Existing ${labels.plural}`;
  const scanLabel = `Scanning ${labels.plural}…`;
  const noProjectHint = 'Open a project with a valid vnext.config.json to list components.';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        variant="secondary"
        className="border-border bg-surface text-foreground gap-0 p-0 shadow-sm"
        showCloseButton
        closeButtonHoverable
        hoverable={false}
        enableResize
        resizeStorageKey="vnext-forge.dialog.choose-existing-task"
        resizeDefaultWidth={520}
        resizeDefaultHeight={600}>
        <DialogHeader>
          <DialogTitle className="text-foreground text-base font-semibold tracking-tight">{title}</DialogTitle>
        </DialogHeader>

        <DialogDescription className="text-muted-foreground text-xs leading-relaxed">{description}</DialogDescription>

        <div className="flex min-h-0 flex-1 flex-col gap-2 px-4 pb-4">
          <Input
            type="search"
            placeholder="Search by key…"
            value={listQuery}
            onChange={(e) => setListQuery(e.target.value)}
            variant="muted"
            size="sm"
            className="w-full max-w-md shrink-0"
            disabled={loading || !canLoad}
            autoComplete="off"
          />

          {loading && (
            <div className="text-muted-foreground flex min-h-[120px] flex-1 items-center justify-center gap-2 text-xs">
              <Loader2
                className="text-muted-foreground size-4 shrink-0 animate-spin motion-reduce:animate-none"
                aria-hidden
              />
              {scanLabel}
            </div>
          )}

          {!loading && loadError && (
            <div className="text-destructive-text shrink-0 text-xs">{loadError}</div>
          )}

          {!loading && !loadError && !canLoad && (
            <p className="text-muted-foreground min-h-[120px] flex-1 py-6 text-center text-xs leading-relaxed">
              {noProjectHint}
            </p>
          )}

          {!loading && !loadError && canLoad && (
            <div className="border-border-subtle bg-surface/30 min-h-0 max-h-[min(52vh,440px)] flex-1 overflow-y-auto rounded-md border p-0.5">
              {filtered.length === 0 ? (
                <div className="text-muted-foreground p-3 text-xs">
                  {items.length === 0
                    ? `No ${labels.singular} components found under configured paths.`
                    : `No ${labels.plural} match your filter.`}
                </div>
              ) : isFlatPicker ? (
                <ul className="space-y-0.5" role="listbox" aria-label={listboxLabel}>
                  {groupedPickRows[0]!.items.map(({ task }) => (
                    <li
                      key={`${task.path}:${task.key}`}
                      className="border-border-subtle/80 bg-background/40 overflow-hidden rounded-md border">
                      <VnextComponentPickerRow
                        component={task}
                        iconType={iconType}
                        onPick={handlePick}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="space-y-1">
                  {groupedPickRows.map((row) => (
                    <div
                      key={`${row.category}\0${row.subgroup}`}
                      className="border-border-subtle/80 overflow-hidden rounded-md border">
                      <div className="bg-muted/30 text-muted-foreground border-border-subtle/80 border-b px-2 py-1 text-[9px] font-medium tracking-wide uppercase">
                        {row.subgroup ? `${row.category} › ${row.subgroup}` : row.category}
                      </div>
                      <ul
                        className="divide-border-subtle/90 divide-y"
                        role="listbox"
                        aria-label={row.subgroup ? `${row.category} ${row.subgroup}` : row.category}>
                        {row.items.map(({ task }) => (
                          <li key={`${task.path}:${task.key}`} className="odd:bg-background/40 even:bg-muted/20">
                            <VnextComponentPickerRow
                              component={task}
                              iconType={iconType}
                              onPick={handlePick}
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export interface ChooseExistingTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Kullanıcı satır seçince çağrılır; dialog kapanır. */
  onSelectTask: (task: DiscoveredVnextComponent) => void;
}

/** Task listesi: `ChooseExistingVnextComponentDialog` + `category="tasks"`. */
export function ChooseExistingTaskDialog({ open, onOpenChange, onSelectTask }: ChooseExistingTaskDialogProps) {
  return (
    <ChooseExistingVnextComponentDialog
      open={open}
      onOpenChange={onOpenChange}
      category="tasks"
      onSelect={onSelectTask}
    />
  );
}

function VnextComponentPickerRow({
  component,
  iconType,
  onPick,
}: {
  component: DiscoveredVnextComponent;
  iconType: VnextComponentType;
  onPick: (t: DiscoveredVnextComponent) => void;
}) {
  return (
    <button
      type="button"
      role="option"
      onClick={() => onPick(component)}
      className="hover:border-border hover:bg-muted/60 motion-safe:transition-colors flex w-full cursor-pointer items-center gap-1.5 border border-transparent px-2 py-1 text-left duration-200 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 focus-visible:outline-none min-h-0">
      <ComponentFileIcon type={iconType} className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="text-foreground flex flex-wrap items-baseline gap-x-1.5 gap-y-0 font-mono leading-tight">
          <span className="text-[11px] font-normal tabular-nums">{component.key}</span>
          {component.version ? (
            <span className="text-muted-foreground bg-muted/50 rounded px-0.5 py-0 text-[9px] font-normal leading-none tabular-nums">
              v{component.version}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}

export interface ChooseFromExistingVnextComponentButtonProps {
  category: VnextExportCategory;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  /** Varsayılan: "Choose from existing {plural}" */
  label?: string;
}

/**
 * Mevcut vNext JSON bileşenlerini (task, workflow, function, …) seçmek için tetikleyici; metin kategoriye göre üretilir.
 */
export function ChooseFromExistingVnextComponentButton({
  category,
  onClick,
  disabled,
  title,
  label,
}: ChooseFromExistingVnextComponentButtonProps) {
  const { plural } = CATEGORY_LABEL[category];
  const defaultLabel = `Choose from existing ${plural}`;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="text-secondary-icon hover:text-secondary-foreground inline-flex min-h-0 cursor-pointer items-center gap-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45">
      <Search className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
      {label ?? defaultLabel}
    </button>
  );
}

/** Task’lar için kısayol: `category="tasks"`. */
export function ChooseFromExistingTasksButton({
  onClick,
  disabled,
  title,
}: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <ChooseFromExistingVnextComponentButton category="tasks" onClick={onClick} disabled={disabled} title={title} />
  );
}
