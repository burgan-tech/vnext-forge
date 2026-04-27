import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { z } from 'zod';
import {
  Controller,
  useForm,
  useWatch,
  type Control,
  type Path,
  type UseFormRegister,
} from 'react-hook-form';
import { AlertCircle, Loader2 } from 'lucide-react';
import {
  buildVnextWorkspaceConfig,
  isSuccess,
  type ApiResponse,
  type VnextWorkspaceConfig,
} from '@vnext-forge/app-contracts';

import { cn } from '../../lib/utils/cn.js';
import { createLogger } from '../../lib/logger/createLogger.js';
import { EditorDocumentToolbar } from '../save-component/components/EditorDocumentToolbar.js';
import { readFile } from '../project-workspace/WorkspaceApi.js';
import { useProjectStore } from '../../store/useProjectStore.js';
import type { ProjectInfo, VnextComponentType } from '../../shared/projectTypes.js';
import { Button } from '../../ui/Button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card.js';
import { Checkbox } from '../../ui/Checkbox.js';
import {
  Dialog,
  DialogCancelButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/Dialog.js';
import { Input } from '../../ui/Input.js';
import { Select } from '../../ui/Select.js';
import { TagEditor } from '../../ui/TagEditor.js';
import { Textarea } from '../../ui/Textarea.js';

import {
  discoverAllVnextComponents,
  type VnextComponentsDiscoveryResult,
  type VnextExportCategory,
} from '../vnext-workspace/vnextComponentDiscovery.js';
import { useWriteVnextWorkspaceConfig } from './useWriteVnextWorkspaceConfig.js';
import { ExportComponentKeyPicker } from './ExportComponentKeyPicker.js';
import {
  normalizeVnextWizardPayload,
  rawConfigToEditableValues,
  validateNormalizedVnextWizardPayload,
  wizardValidationIssueMap,
} from './wizardValidation.js';

const logger = createLogger('CreateVnextConfigDialog');

function stringArrayToMultiline(value: unknown): string {
  if (!Array.isArray(value)) return '';
  return value.map((item) => String(item)).join('\n');
}

/** Boş satırları silme: Enter ile yeni satır `""` öğesi olarak kalır; yalnızca satır içi trim. */
function multilineToStringArray(text: string): string[] {
  if (text === '') return [];
  return text.split('\n').map((line) => line.trim());
}

/** Exports kart gövdesinde bir kez — kategori başlığı / liste hiyerarşisini şişirmemek için. */
const exportComponentsIntroText =
  'Choose definitions to ship with this workspace. Toggle rows on or off; saving updates vnext.config.json.';

function pickWizardFieldError(
  issues: Record<string, string>,
  basePath: string,
): string | undefined {
  if (issues[basePath]) {
    return issues[basePath];
  }
  const nested = Object.keys(issues).find((k) => k.startsWith(`${basePath}.`));
  return nested ? issues[nested] : undefined;
}

/** Zod path → formdaki kart/başlıklarla uyumlu kısa Türkçe etiket. */
function friendlyWizardIssuePath(pathParts: readonly PropertyKey[]): string {
  const p = pathParts.map((part) => String(part));
  if (p.length === 0) return 'Configuration';

  const [a, b, c, d] = [p[0], p[1], p[2], p[3]];

  const rootFields = new Set([
    'version',
    'description',
    'domain',
    'runtimeVersion',
    'schemaVersion',
  ]);
  if (p.length === 1 && a && rootFields.has(a)) {
    return `Root card: ${a} field`;
  }

  if (a === 'paths' && p.length === 2 && b) {
    return `Paths card: ${b} field`;
  }

  if (a === 'dependencies' && p.length === 2 && b) {
    return `Dependencies card: ${b} field`;
  }

  if (
    a === 'dependencies' &&
    b &&
    (typeof c === 'number' || (typeof c === 'string' && /^\d+$/.test(c)))
  ) {
    const idx = typeof c === 'number' ? c : Number(c);
    return `Dependencies card, ${b} (item ${idx + 1})`;
  }

  if (a === 'referenceResolution' && b === 'allowedHosts') {
    return 'Reference resolution card: allowedHosts field';
  }

  if (a === 'referenceResolution' && b === 'schemaValidationRules' && c) {
    return `Reference resolution card, schemaValidationRules: ${c} field`;
  }

  if (a === 'exports' && b === 'metadata') {
    if (c === 'keywords' && (typeof d === 'number' || (typeof d === 'string' && /^\d+$/.test(d)))) {
      const idx = typeof d === 'number' ? d : Number(d);
      return `Exports card, metadata keywords (item ${idx + 1})`;
    }
    if (c) {
      return `Exports card, metadata: ${c} field`;
    }
  }

  if (p.length === 1 && a === 'allowedHosts') {
    return 'Reference resolution card: allowedHosts field';
  }

  if (a === 'referenceResolution' && p.length >= 2) {
    return `Reference resolution card: ${p.slice(1).join(' › ')} field`;
  }

  return p.join(' › ');
}

/** Mesajda tekrarlayan teknik path önekini kaldırır. */
function wizardIssueMessageForDisplay(message: string, pathParts: readonly PropertyKey[]): string {
  let m = message.trim();
  const joined = pathParts.map((part) => String(part)).join('.');
  if (joined) {
    const re = new RegExp(`^\\s*${joined.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:?\\s*`, 'i');
    m = m.replace(re, '').trim();
  }
  return m || message.trim();
}

/** Form etiketleri: `text-sm`; uzun teknik isimler grid hücresinde kırılır (`break-words`, `min-w-0`). */
const labelMono =
  'block font-mono text-sm font-medium leading-normal tracking-tight text-foreground break-words';

function JsonFieldShell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-2">
      <label className={labelMono}>{label}</label>
      {children}
    </div>
  );
}

function JsonTextField({
  label,
  register,
  name,
  placeholder,
  className,
  errorText,
}: {
  label: string;
  register: UseFormRegister<VnextWorkspaceConfig>;
  name: Path<VnextWorkspaceConfig>;
  placeholder?: string;
  className?: string;
  errorText?: string;
}) {
  return (
    <JsonFieldShell label={label}>
      <Input
        {...register(name)}
        placeholder={placeholder}
        variant="default"
        hoverable={false}
        aria-invalid={Boolean(errorText)}
        className={cn(
          errorText &&
            'border-destructive-border ring-destructive/20 focus-visible:ring-destructive/30',
          className,
        )}
      />
      {errorText ? (
        <p className="text-destructive mt-1 flex items-start gap-1 text-xs leading-normal">
          <AlertCircle className="mt-px size-3 shrink-0" aria-hidden />
          {errorText}
        </p>
      ) : null}
    </JsonFieldShell>
  );
}

function JsonBoolField({
  label,
  control,
  name,
}: {
  label: string;
  control: Control<VnextWorkspaceConfig>;
  name: Path<VnextWorkspaceConfig>;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <JsonFieldShell label={label}>
          <Select
            value={field.value ? 'true' : 'false'}
            onChange={(e) => field.onChange(e.target.value === 'true')}
            variant="default"
            hoverable={false}
            className="w-full">
            <option value="true">true</option>
            <option value="false">false</option>
          </Select>
        </JsonFieldShell>
      )}
    />
  );
}

function JsonTagField({
  label,
  control,
  name,
  placeholder,
  errorText,
}: {
  label: string;
  control: Control<VnextWorkspaceConfig>;
  name: Path<VnextWorkspaceConfig>;
  placeholder?: string;
  errorText?: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <JsonFieldShell label={label}>
          <TagEditor
            tags={
              Array.isArray(field.value)
                ? field.value.filter((t): t is string => typeof t === 'string')
                : []
            }
            onChange={field.onChange}
            placeholder={placeholder ?? 'Add item…'}
            variant="default"
            hoverable={false}
            className={cn(errorText && 'ring-destructive/25 ring-2')}
          />
          {errorText ? (
            <p className="text-destructive mt-1 text-xs leading-normal">{errorText}</p>
          ) : null}
        </JsonFieldShell>
      )}
    />
  );
}

/** `string[]` alanları için: her satır bir öğe (etiket / tag UI yok). */
function JsonStringArrayLinesField({
  label,
  control,
  name,
  placeholder,
  helperText,
  errorText,
}: {
  label: string;
  control: Control<VnextWorkspaceConfig>;
  name: Path<VnextWorkspaceConfig>;
  placeholder?: string;
  helperText?: string;
  errorText?: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <JsonFieldShell label={label}>
          <div className="space-y-2">
            <Textarea
              ref={field.ref}
              name={field.name}
              value={stringArrayToMultiline(field.value)}
              onBlur={field.onBlur}
              onChange={(e) => field.onChange(multilineToStringArray(e.target.value))}
              placeholder={placeholder}
              variant="default"
              hoverable={false}
              rows={3}
              aria-invalid={Boolean(errorText)}
              className={cn(
                'min-h-20 resize-y font-mono text-sm leading-relaxed',
                errorText &&
                  'border-destructive-border ring-destructive/20 focus-visible:ring-destructive/30',
              )}
              spellCheck={false}
            />
            {errorText ? (
              <p className="text-destructive text-xs leading-normal">{errorText}</p>
            ) : null}
            {helperText ? (
              <p className="text-muted-foreground text-xs leading-normal">{helperText}</p>
            ) : null}
          </div>
        </JsonFieldShell>
      )}
    />
  );
}

function exportCategoryDisplayTitle(cat: VnextExportCategory): string {
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

/** `ChooseExistingVnextComponentDialog` ile aynı kategori → dosya ikonu eşlemesi. */
const EXPORT_CATEGORY_ICON: Record<VnextExportCategory, VnextComponentType> = {
  workflows: 'workflow',
  tasks: 'task',
  schemas: 'schema',
  views: 'view',
  functions: 'function',
  extensions: 'extension',
};

/** Workspace’tan keşfedilen anahtarlarla exports `string[]` alanını doldurur. */
function ExportKeysFieldWithPicker({
  control,
  name,
  errorText,
  category,
  discovery,
  discoveryLoading,
}: {
  control: Control<VnextWorkspaceConfig>;
  name: Path<VnextWorkspaceConfig>;
  errorText?: string;
  category: VnextExportCategory;
  discovery: VnextComponentsDiscoveryResult | null;
  discoveryLoading: boolean;
}) {
  const options = discovery?.components[category] ?? [];
  const headingId = `vnext-export-${category}-heading`;
  const title = exportCategoryDisplayTitle(category);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const selectedKeys = Array.isArray(field.value)
          ? field.value.filter((t): t is string => typeof t === 'string')
          : [];
        const optionKeySet = new Set(options.map((o) => o.key));
        const selectedCount = selectedKeys.filter((k) => optionKeySet.has(k)).length;
        const totalListed = options.length;

        return (
        <section
          className="bg-muted/10 min-w-0 space-y-2.5 rounded-xl px-3 py-3 sm:px-4"
          aria-labelledby={headingId}>
          <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
            <h4
              id={headingId}
              className="text-foreground font-sans text-sm font-medium leading-snug tracking-tight">
              {title}
            </h4>
            <p
              className="text-muted-foreground m-0 max-w-[min(100%,14rem)] text-right text-xs leading-snug tabular-nums sm:max-w-none"
              aria-live="polite"
              aria-label={
                discoveryLoading
                  ? 'Scanning workspace for components'
                  : totalListed === 0
                    ? 'No components in this category'
                    : `${selectedCount} of ${totalListed} selected for export`
              }>
              {discoveryLoading ? (
                'Scanning…'
              ) : totalListed === 0 ? (
                'No items'
              ) : (
                <>
                  <span
                    className={cn(
                      'font-medium tabular-nums',
                      selectedCount > 0 ? 'text-success-text' : 'text-muted-foreground',
                    )}>
                    {selectedCount}
                  </span>
                  <span className="text-muted-foreground">{' of '}</span>
                  <span className="text-muted-foreground tabular-nums">{totalListed}</span>
                  <span className="text-muted-foreground"> selected</span>
                </>
              )}
            </p>
          </header>
          <ExportComponentKeyPicker
            iconType={EXPORT_CATEGORY_ICON[category]}
            ariaLabelledBy={headingId}
            options={options}
            value={
              Array.isArray(field.value)
                ? field.value.filter((t): t is string => typeof t === 'string')
                : []
            }
            onChange={(keys) => {
              field.onChange(keys);
              void field.onBlur();
            }}
            loading={discoveryLoading}
          />
          {errorText ? (
            <p className="text-destructive text-xs leading-normal">{errorText}</p>
          ) : null}
        </section>
        );
      }}
    />
  );
}

interface CreateVnextConfigDialogProps {
  projectId: string;
  defaultDomain: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: (nextProjectId: string) => void | Promise<void>;
  /**
   * `dialog`: Radix modal (eksik config sihirbazı).
   * `embedded`: Tam sayfa sekme gövdesi — üst seviye `Dialog` yok.
   */
  presentation?: 'dialog' | 'embedded';
  /** Yalnız `embedded`: Save çubuğu web sekme satırının sağına (`ProjectEditorShell`). */
  registerToolbar?: (toolbar: ReactNode | null) => void;
}

export function CreateVnextConfigDialog({
  projectId,
  defaultDomain,
  open,
  onOpenChange,
  onCompleted,
  presentation = 'dialog',
  registerToolbar,
}: CreateVnextConfigDialogProps) {
  const seed = useMemo((): VnextWorkspaceConfig => {
    const d = defaultDomain.trim() || 'workspace';
    return buildVnextWorkspaceConfig({
      domain: d,
      description: `${d} domain configuration`,
      exportsMetadataDescription: `Exported components for ${d} domain`,
    });
  }, [defaultDomain]);

  const form = useForm<VnextWorkspaceConfig>({
    mode: 'onChange',
    defaultValues: seed,
  });

  const { register, control, handleSubmit, reset, setValue, getValues, formState } = form;
  const { isDirty } = formState;
  const domain = useWatch({ control, name: 'domain' });
  const watchedPaths = useWatch({ control, name: 'paths', defaultValue: seed.paths });
  const watchedForm = useWatch({ control, defaultValue: seed });
  const pathsKey = useMemo(() => JSON.stringify(watchedPaths), [watchedPaths]);
  const [debouncedPaths, setDebouncedPaths] = useState(seed.paths);
  const [discovery, setDiscovery] = useState<VnextComponentsDiscoveryResult | null>(null);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [useCustomComponentsRoot, setUseCustomComponentsRoot] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [undoStack, setUndoStack] = useState<VnextWorkspaceConfig[]>([]);
  const [redoStack, setRedoStack] = useState<VnextWorkspaceConfig[]>([]);
  const pendingSubmitValuesRef = useRef<VnextWorkspaceConfig | null>(null);
  const submitFormRef = useRef<() => void>(() => {});
  const prevFormSerializedRef = useRef<string | null>(null);
  const skipHistoryRef = useRef(true);

  const hasSavedForToolbar = !isDirty && undoStack.length > 0;

  const normalizedWizardPayload = useMemo(
    () => normalizeVnextWizardPayload(watchedForm as VnextWorkspaceConfig),
    [watchedForm],
  );
  const wizardValidation = useMemo(
    () => validateNormalizedVnextWizardPayload(normalizedWizardPayload),
    [normalizedWizardPayload],
  );
  const fieldIssues = useMemo(
    () => (wizardValidation.success ? {} : wizardValidationIssueMap(wizardValidation.error)),
    [wizardValidation],
  );

  const writeOptions = useMemo(
    () => ({
      onSuccess: async (result: ApiResponse<ProjectInfo>) => {
        if (!isSuccess(result)) return;
        const pending = pendingSubmitValuesRef.current;
        pendingSubmitValuesRef.current = null;
        if (pending) {
          skipHistoryRef.current = true;
          reset(pending);
        }
        if (presentation === 'dialog') {
          onOpenChange(false);
        }
        await onCompleted(result.data.id);
      },
      onError: () => {
        pendingSubmitValuesRef.current = null;
      },
      successMessage: isEditMode ? 'vnext.config.json updated.' : 'vnext.config.json created.',
    }),
    [isEditMode, onCompleted, onOpenChange, presentation, reset],
  );

  const { execute: writeConfig, loading: writing } = useWriteVnextWorkspaceConfig(writeOptions);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedPaths(watchedPaths);
    }, 300);
    return () => window.clearTimeout(t);
  }, [pathsKey, watchedPaths]);

  useEffect(() => {
    if (!open || loadingConfig) {
      setDiscovery(null);
      setDiscoveryLoading(false);
      return;
    }
    const projectPath = useProjectStore.getState().activeProject?.path;
    if (!projectPath) {
      setDiscovery(null);
      setDiscoveryLoading(false);
      return;
    }
    let cancelled = false;
    setDiscoveryLoading(true);
    void discoverAllVnextComponents(projectId, { previewPaths: debouncedPaths })
      .then((res) => {
        if (!cancelled) setDiscovery(res);
      })
      .catch(() => {
        if (!cancelled) setDiscovery(null);
      })
      .finally(() => {
        if (!cancelled) setDiscoveryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, loadingConfig, projectId, debouncedPaths]);

  useEffect(() => {
    if (!open) {
      setUndoStack([]);
      setRedoStack([]);
      prevFormSerializedRef.current = null;
      skipHistoryRef.current = true;
      queueMicrotask(() => {
        setIsEditMode(false);
        setLoadingConfig(false);
      });
      return;
    }

    const projectPath = useProjectStore.getState().activeProject?.path;
    if (!projectPath) {
      queueMicrotask(() => {
        setIsEditMode(false);
        setUseCustomComponentsRoot(false);
      });
      setUndoStack([]);
      setRedoStack([]);
      prevFormSerializedRef.current = null;
      skipHistoryRef.current = true;
      reset(seed);
      return;
    }

    let cancelled = false;
    queueMicrotask(() => setLoadingConfig(true));

    void (async () => {
      try {
        const { content } = await readFile(`${projectPath}/vnext.config.json`);
        const parsed: unknown = JSON.parse(content);
        if (cancelled) return;

        setUndoStack([]);
        setRedoStack([]);
        prevFormSerializedRef.current = null;
        skipHistoryRef.current = true;

        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const editable = rawConfigToEditableValues(parsed as Record<string, unknown>);
          const rawPaths = (parsed as Record<string, unknown>).paths;
          const rawDomain = (parsed as Record<string, unknown>).domain;
          const hasCustomRoot =
            rawPaths != null &&
            typeof rawPaths === 'object' &&
            typeof (rawPaths as Record<string, unknown>).componentsRoot === 'string' &&
            (rawPaths as Record<string, unknown>).componentsRoot !== rawDomain;
          setIsEditMode(true);
          setUseCustomComponentsRoot(hasCustomRoot);
          reset(editable);
        } else {
          setIsEditMode(false);
          setUseCustomComponentsRoot(false);
          reset(seed);
        }
      } catch {
        if (cancelled) return;
        logger.info('Mevcut vnext.config.json okunamadı, yeni oluşturma modunda açılıyor.');
        setUndoStack([]);
        setRedoStack([]);
        prevFormSerializedRef.current = null;
        skipHistoryRef.current = true;
        setIsEditMode(false);
        setUseCustomComponentsRoot(false);
        reset(seed);
      } finally {
        if (!cancelled) setLoadingConfig(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, reset, seed]);

  useEffect(() => {
    if (!useCustomComponentsRoot && domain) {
      skipHistoryRef.current = true;
      setValue('paths.componentsRoot', domain.trim(), { shouldDirty: false, shouldValidate: true });
    }
  }, [domain, setValue, useCustomComponentsRoot]);

  useEffect(() => {
    if (loadingConfig) return;
    const data = watchedForm as VnextWorkspaceConfig;
    const serialized = JSON.stringify(data);

    if (skipHistoryRef.current) {
      skipHistoryRef.current = false;
      prevFormSerializedRef.current = serialized;
      return;
    }

    if (prevFormSerializedRef.current === null) {
      prevFormSerializedRef.current = serialized;
      return;
    }

    if (prevFormSerializedRef.current === serialized) return;

    try {
      const prevValues = JSON.parse(prevFormSerializedRef.current) as VnextWorkspaceConfig;
      setUndoStack((u) => [...u.slice(-49), prevValues]);
      setRedoStack([]);
    } catch {
      /* ignore */
    }
    prevFormSerializedRef.current = serialized;
  }, [watchedForm, loadingConfig]);

  const onSubmit = handleSubmit(async (values) => {
    const normalized = normalizeVnextWizardPayload(values);
    const parsed = validateNormalizedVnextWizardPayload(normalized);
    if (!parsed.success) {
      return;
    }
    pendingSubmitValuesRef.current = values;
    await writeConfig(projectId, parsed.data);
  });

  submitFormRef.current = () => {
    void onSubmit();
  };

  const stableOnSave = useCallback(() => {
    submitFormRef.current();
  }, []);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prevValues = undoStack[undoStack.length - 1];
    const current = getValues();
    skipHistoryRef.current = true;
    setRedoStack((r) => [...r, current]);
    setUndoStack((u) => u.slice(0, -1));
    reset(prevValues);
  }, [undoStack, getValues, reset]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextValues = redoStack[redoStack.length - 1];
    const current = getValues();
    skipHistoryRef.current = true;
    setUndoStack((u) => [...u, current]);
    setRedoStack((r) => r.slice(0, -1));
    reset(nextValues);
  }, [redoStack, getValues, reset]);

  const undoRef = useRef(undo);
  const redoRef = useRef(redo);
  undoRef.current = undo;
  redoRef.current = redo;

  const stableOnUndo = useCallback(() => {
    undoRef.current();
  }, []);
  const stableOnRedo = useCallback(() => {
    redoRef.current();
  }, []);

  const isDialog = presentation === 'dialog';
  const titleText = isEditMode ? 'Editing vnext.config.json' : 'vnext.config.json is required';

  /** Tam ekran: ExtensionEditorPanel ile aynı kart yüzeyi; modal: mevcut iç içe secondary/tertiary. */
  const sectionCardVariant = isDialog ? ('secondary' as const) : ('default' as const);
  const sectionCardClassName = isDialog ? 'gap-4 py-5 shadow-none' : 'gap-3';
  const sectionHeaderClassName = isDialog ? 'px-5 pb-0' : 'border-border border-b';
  const sectionTitleClassName = isDialog ? 'font-mono text-sm font-medium' : 'text-base';
  const sectionContentPad = isDialog ? 'px-5' : 'px-4 sm:px-6';
  const nestedCardVariant = isDialog ? ('tertiary' as const) : ('secondary' as const);
  const nestedCardClassName = isDialog ? 'gap-3 py-4 shadow-none' : 'gap-3 shadow-none';
  const nestedHeaderClassName = isDialog ? 'px-4 pb-0' : 'border-border border-b';
  const nestedTitleClassName = isDialog
    ? 'text-tertiary-text font-mono text-xs leading-snug font-medium'
    : 'text-sm';
  const nestedContentClassName = isDialog ? 'px-4' : 'px-4 sm:px-6';

  const hostToolbar = useMemo(
    () => (
      <EditorDocumentToolbar
        arrangement="host-row"
        isDirty={isDirty}
        hasSaved={hasSavedForToolbar}
        saving={writing}
        onSave={stableOnSave}
        onUndo={stableOnUndo}
        onRedo={stableOnRedo}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
      />
    ),
    [
      hasSavedForToolbar,
      isDirty,
      redoStack.length,
      stableOnRedo,
      stableOnSave,
      stableOnUndo,
      undoStack.length,
      writing,
    ],
  );

  useEffect(() => {
    if (isDialog || !registerToolbar) return;
    registerToolbar(hostToolbar);
    return () => {
      registerToolbar(null);
    };
  }, [hostToolbar, isDialog, registerToolbar]);

  const shell = (
    <div className={cn('flex flex-col', isDialog ? 'max-h-[min(90vh,920px)]' : 'h-full min-h-0')}>
      {isDialog ? (
        <div className="my-1 shrink-0">
          <DialogHeader className="border-0 border-b-0 px-6 py-5 text-left">
            <DialogTitle className="text-primary-text">{titleText}</DialogTitle>
          </DialogHeader>
        </div>
      ) : null}

      {loadingConfig ? (
        <div className="flex flex-1 items-center justify-center py-20">
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </div>
      ) : null}

      <form
        className={cn('flex min-h-0 flex-1 flex-col', loadingConfig && 'hidden')}
        onSubmit={(e) => void onSubmit(e)}>
        <div className={cn('min-h-0 flex-1 overflow-y-auto', isDialog ? 'px-6 py-5' : 'p-4')}>
          {!wizardValidation.success ? (
            <div
              role="alert"
              className="border-destructive-border bg-destructive/5 mb-6 rounded-xl border p-4">
              <div className="text-destructive flex gap-2 text-sm">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <div className="min-w-0 space-y-2">
                  <p className="leading-snug font-semibold">
                    Required fields are missing or invalid
                  </p>
                  <ul className="text-destructive/95 max-h-40 list-inside list-disc overflow-y-auto text-xs leading-relaxed">
                    {Array.from(
                      new Set(
                        wizardValidation.error.issues.map((i: z.core.$ZodIssue) => {
                          const label = friendlyWizardIssuePath(i.path);
                          const detail = wizardIssueMessageForDisplay(i.message, i.path);
                          return `${label}: ${detail}`;
                        }),
                      ),
                    ).map((line) => (
                      <li key={line} className="wrap-break-word">
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}
          <div
            className={cn('grid min-w-0 grid-cols-1 xl:grid-cols-2', isDialog ? 'gap-6' : 'gap-4')}>
            <div className={cn('min-w-0', isDialog ? 'space-y-6' : 'space-y-4')}>
              <Card variant={sectionCardVariant} hoverable={false} className={sectionCardClassName}>
                <CardHeader className={sectionHeaderClassName}>
                  <CardTitle className={sectionTitleClassName}>
                    {isDialog ? 'Root' : 'Workspace root'}
                  </CardTitle>
                  {!isDialog ? (
                    <CardDescription className="text-xs">
                      Domain, description, and runtime/schema versions for this workspace.
                    </CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent
                  className={cn(
                    'grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2',
                    sectionContentPad,
                  )}>
                  <JsonTextField
                    label="version"
                    register={register}
                    name="version"
                    errorText={pickWizardFieldError(fieldIssues, 'version')}
                  />
                  <JsonTextField
                    label="domain"
                    register={register}
                    name="domain"
                    errorText={pickWizardFieldError(fieldIssues, 'domain')}
                  />
                  <JsonTextField
                    label="description"
                    register={register}
                    name="description"
                    className="sm:col-span-2"
                    errorText={pickWizardFieldError(fieldIssues, 'description')}
                  />
                  <JsonTextField
                    label="runtimeVersion"
                    register={register}
                    name="runtimeVersion"
                    errorText={pickWizardFieldError(fieldIssues, 'runtimeVersion')}
                  />
                  <JsonTextField
                    label="schemaVersion"
                    register={register}
                    name="schemaVersion"
                    errorText={pickWizardFieldError(fieldIssues, 'schemaVersion')}
                  />
                </CardContent>
              </Card>

              <Card variant={sectionCardVariant} hoverable={false} className={sectionCardClassName}>
                <CardHeader className={sectionHeaderClassName}>
                  <CardTitle className={sectionTitleClassName}>
                    {isDialog ? 'paths' : 'Paths'}
                  </CardTitle>
                  {!isDialog ? (
                    <CardDescription className="text-xs">
                      Component folder paths relative to the project root.
                    </CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent className={cn('space-y-4', sectionContentPad)}>
                  <label className="text-foreground flex cursor-pointer items-center gap-2 text-sm leading-normal font-medium">
                    <Checkbox
                      checked={useCustomComponentsRoot}
                      onCheckedChange={(v) => setUseCustomComponentsRoot(v === true)}
                    />
                    <span className="font-mono">Use custom componentsRoot</span>
                  </label>
                  <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                    <JsonFieldShell label="componentsRoot">
                      <Input
                        {...register('paths.componentsRoot')}
                        placeholder={domain || 'componentsRoot'}
                        variant={useCustomComponentsRoot ? 'default' : 'muted'}
                        readOnly={!useCustomComponentsRoot}
                        hoverable={false}
                        aria-invalid={Boolean(
                          pickWizardFieldError(fieldIssues, 'paths.componentsRoot'),
                        )}
                        className={cn(
                          pickWizardFieldError(fieldIssues, 'paths.componentsRoot') &&
                            'border-destructive-border ring-destructive/20 focus-visible:ring-destructive/30',
                        )}
                      />
                      {pickWizardFieldError(fieldIssues, 'paths.componentsRoot') ? (
                        <p className="text-destructive mt-1 flex items-start gap-1 text-xs leading-normal">
                          <AlertCircle className="mt-px size-3 shrink-0" aria-hidden />
                          {pickWizardFieldError(fieldIssues, 'paths.componentsRoot')}
                        </p>
                      ) : null}
                    </JsonFieldShell>
                    <JsonTextField
                      label="tasks"
                      register={register}
                      name="paths.tasks"
                      errorText={pickWizardFieldError(fieldIssues, 'paths.tasks')}
                    />
                    <JsonTextField
                      label="views"
                      register={register}
                      name="paths.views"
                      errorText={pickWizardFieldError(fieldIssues, 'paths.views')}
                    />
                    <JsonTextField
                      label="functions"
                      register={register}
                      name="paths.functions"
                      errorText={pickWizardFieldError(fieldIssues, 'paths.functions')}
                    />
                    <JsonTextField
                      label="extensions"
                      register={register}
                      name="paths.extensions"
                      errorText={pickWizardFieldError(fieldIssues, 'paths.extensions')}
                    />
                    <JsonTextField
                      label="workflows"
                      register={register}
                      name="paths.workflows"
                      errorText={pickWizardFieldError(fieldIssues, 'paths.workflows')}
                    />
                    <JsonTextField
                      label="schemas"
                      register={register}
                      name="paths.schemas"
                      errorText={pickWizardFieldError(fieldIssues, 'paths.schemas')}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card variant={sectionCardVariant} hoverable={false} className={sectionCardClassName}>
                <CardHeader className={sectionHeaderClassName}>
                  <CardTitle className={sectionTitleClassName}>
                    {isDialog ? 'dependencies' : 'Dependencies'}
                  </CardTitle>
                  {!isDialog ? (
                    <CardDescription className="text-xs">
                      Cross-domain and npm package references for this workspace.
                    </CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent className={cn('space-y-4', sectionContentPad)}>
                  <JsonStringArrayLinesField
                    label="domains"
                    control={control}
                    name="dependencies.domains"
                    placeholder="other-domain-key"
                    helperText="One domain key per line."
                    errorText={pickWizardFieldError(fieldIssues, 'dependencies.domains')}
                  />
                  <JsonStringArrayLinesField
                    label="npm"
                    control={control}
                    name="dependencies.npm"
                    placeholder="@scope/package@^1.0.0"
                    helperText="One npm package specifier per line."
                    errorText={pickWizardFieldError(fieldIssues, 'dependencies.npm')}
                  />
                </CardContent>
              </Card>

              <Card variant={sectionCardVariant} hoverable={false} className={sectionCardClassName}>
                <CardHeader className={sectionHeaderClassName}>
                  <CardTitle className={sectionTitleClassName}>
                    {isDialog ? 'referenceResolution' : 'Reference resolution'}
                  </CardTitle>
                  {!isDialog ? (
                    <CardDescription className="text-xs">
                      Build-time validation, strict mode, and registry host allowlists.
                    </CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent className={cn('space-y-4', sectionContentPad)}>
                  <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                    <JsonBoolField
                      label="enabled"
                      control={control}
                      name="referenceResolution.enabled"
                    />
                    <JsonBoolField
                      label="validateOnBuild"
                      control={control}
                      name="referenceResolution.validateOnBuild"
                    />
                    <JsonBoolField
                      label="strictMode"
                      control={control}
                      name="referenceResolution.strictMode"
                    />
                    <JsonBoolField
                      label="validateReferenceConsistency"
                      control={control}
                      name="referenceResolution.validateReferenceConsistency"
                    />
                    <JsonBoolField
                      label="validateSchemas"
                      control={control}
                      name="referenceResolution.validateSchemas"
                    />
                  </div>
                  <JsonStringArrayLinesField
                    label="allowedHosts"
                    control={control}
                    name="referenceResolution.allowedHosts"
                    placeholder="registry.npmjs.org"
                    helperText="One hostname per line."
                    errorText={pickWizardFieldError(
                      fieldIssues,
                      'referenceResolution.allowedHosts',
                    )}
                  />

                  <Card
                    variant={nestedCardVariant}
                    hoverable={false}
                    className={nestedCardClassName}>
                    <CardHeader className={nestedHeaderClassName}>
                      <CardTitle className={nestedTitleClassName}>
                        {isDialog ? 'schemaValidationRules' : 'Schema validation rules'}
                      </CardTitle>
                      {!isDialog ? (
                        <CardDescription className="text-xs">
                          Filename, key, and version consistency for JSON definitions.
                        </CardDescription>
                      ) : null}
                    </CardHeader>
                    <CardContent
                      className={cn(
                        'grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2',
                        nestedContentClassName,
                      )}>
                      <JsonBoolField
                        label="enforceKeyFormat"
                        control={control}
                        name="referenceResolution.schemaValidationRules.enforceKeyFormat"
                      />
                      <JsonBoolField
                        label="enforceVersionFormat"
                        control={control}
                        name="referenceResolution.schemaValidationRules.enforceVersionFormat"
                      />
                      <JsonBoolField
                        label="enforceFilenameConsistency"
                        control={control}
                        name="referenceResolution.schemaValidationRules.enforceFilenameConsistency"
                      />
                      <JsonBoolField
                        label="allowUnknownProperties"
                        control={control}
                        name="referenceResolution.schemaValidationRules.allowUnknownProperties"
                      />
                    </CardContent>
                  </Card>
                </CardContent>
              </Card>
            </div>

            <div className={cn('min-w-0', isDialog ? 'space-y-6' : 'space-y-4')}>
              <Card variant={sectionCardVariant} hoverable={false} className={sectionCardClassName}>
                <CardHeader className={sectionHeaderClassName}>
                  <CardTitle className={sectionTitleClassName}>Exports</CardTitle>
                  <CardDescription
                    className={cn(
                      'text-muted-foreground max-w-prose text-xs leading-relaxed',
                      isDialog ? 'pt-1' : 'pt-0.5',
                    )}>
                    Published component keys, visibility, and package metadata.
                  </CardDescription>
                </CardHeader>
                <CardContent className={cn('space-y-6', sectionContentPad)}>
                  <p className="border-border/50 bg-muted/15 text-muted-foreground max-w-2xl rounded-lg border px-3 py-2.5 text-xs leading-relaxed">
                    {exportComponentsIntroText}
                  </p>
                  <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="min-w-0 sm:col-span-2">
                      <ExportKeysFieldWithPicker
                        control={control}
                        name="exports.functions"
                        category="functions"
                        discovery={discovery}
                        discoveryLoading={discoveryLoading}
                      />
                    </div>
                    <div className="min-w-0 sm:col-span-2">
                      <ExportKeysFieldWithPicker
                        control={control}
                        name="exports.workflows"
                        category="workflows"
                        discovery={discovery}
                        discoveryLoading={discoveryLoading}
                      />
                    </div>
                    <div className="min-w-0 sm:col-span-2">
                      <ExportKeysFieldWithPicker
                        control={control}
                        name="exports.tasks"
                        category="tasks"
                        discovery={discovery}
                        discoveryLoading={discoveryLoading}
                      />
                    </div>
                    <div className="min-w-0 sm:col-span-2">
                      <ExportKeysFieldWithPicker
                        control={control}
                        name="exports.views"
                        category="views"
                        discovery={discovery}
                        discoveryLoading={discoveryLoading}
                      />
                    </div>
                    <div className="min-w-0 sm:col-span-2">
                      <ExportKeysFieldWithPicker
                        control={control}
                        name="exports.schemas"
                        category="schemas"
                        discovery={discovery}
                        discoveryLoading={discoveryLoading}
                      />
                    </div>
                    <div className="min-w-0 sm:col-span-2">
                      <ExportKeysFieldWithPicker
                        control={control}
                        name="exports.extensions"
                        category="extensions"
                        discovery={discovery}
                        discoveryLoading={discoveryLoading}
                      />
                    </div>
                  </div>
                  <Controller
                    control={control}
                    name="exports.visibility"
                    render={({ field }) => (
                      <JsonFieldShell label="visibility">
                        <Select
                          value={field.value}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value as VnextWorkspaceConfig['exports']['visibility'],
                            )
                          }
                          variant="default"
                          hoverable={false}
                          className="w-full">
                          <option value="public">public</option>
                          <option value="private">private</option>
                        </Select>
                      </JsonFieldShell>
                    )}
                  />

                  <Card
                    variant={nestedCardVariant}
                    hoverable={false}
                    className={nestedCardClassName}>
                    <CardHeader className={nestedHeaderClassName}>
                      <CardTitle className={nestedTitleClassName}>
                        {isDialog ? 'metadata' : 'Metadata'}
                      </CardTitle>
                      {!isDialog ? (
                        <CardDescription className="text-xs">
                          Description, maintainer, license, and keyword tags for the package.
                        </CardDescription>
                      ) : null}
                    </CardHeader>
                    <CardContent className={cn('space-y-4', nestedContentClassName)}>
                      <JsonTextField
                        label="description"
                        register={register}
                        name="exports.metadata.description"
                        errorText={pickWizardFieldError(
                          fieldIssues,
                          'exports.metadata.description',
                        )}
                      />
                      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                        <JsonTextField
                          label="maintainer"
                          register={register}
                          name="exports.metadata.maintainer"
                          errorText={pickWizardFieldError(
                            fieldIssues,
                            'exports.metadata.maintainer',
                          )}
                        />
                        <JsonTextField
                          label="license"
                          register={register}
                          name="exports.metadata.license"
                          errorText={pickWizardFieldError(fieldIssues, 'exports.metadata.license')}
                        />
                      </div>
                      <div className="min-w-0">
                        <JsonTagField
                          label="keywords"
                          control={control}
                          name="exports.metadata.keywords"
                          placeholder="keyword…"
                          errorText={pickWizardFieldError(fieldIssues, 'exports.metadata.keywords')}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {isDialog ? (
          <DialogFooter className="border-border-subtle shrink-0 gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end">
            <DialogCancelButton type="button" variant="secondary" className="rounded-xl">
              Close
            </DialogCancelButton>
            <Button
              type="submit"
              variant="success"
              className="rounded-xl"
              loading={writing}
              disabled={!wizardValidation.success}>
              {isEditMode ? 'Update and save' : 'Create and save'}
            </Button>
          </DialogFooter>
        ) : null}
      </form>
    </div>
  );

  if (isDialog) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          variant="default"
          className="w-full max-w-[min(72rem,calc(100vw-1.5rem))] gap-0 rounded-2xl p-0 sm:max-w-[min(72rem,calc(100vw-1.5rem))]">
          {shell}
        </DialogContent>
      </Dialog>
    );
  }

  if (!open) return null;

  return (
    <div className="bg-background flex h-full min-h-0 w-full flex-col overflow-hidden">{shell}</div>
  );
}
