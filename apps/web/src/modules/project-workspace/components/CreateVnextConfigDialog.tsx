import { useEffect, useMemo, useState, type ReactNode } from 'react';
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

import type { ProjectInfo } from '@modules/project-management/ProjectTypes';
import { useProjectStore } from '@app/store/useProjectStore';
import { Button } from '@shared/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/Card';
import { Checkbox } from '@shared/ui/Checkbox';
import {
  Dialog,
  DialogCancelButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/ui/Dialog';
import { Input } from '@shared/ui/Input';
import { Select } from '@shared/ui/Select';
import { TagEditor } from '@shared/ui/TagEditor';
import { Textarea } from '@shared/ui/Textarea';
import { cn } from '@shared/lib/utils/cn';
import { createLogger } from '@shared/lib/logger/createLogger';

import { readFile } from '../WorkspaceApi';
import { useWriteVnextWorkspaceConfig } from '../hooks/useWriteVnextWorkspaceConfig';
import {
  normalizeVnextWizardPayload,
  rawConfigToEditableValues,
  validateNormalizedVnextWizardPayload,
  wizardValidationIssueMap,
} from '../vnextWorkspaceConfigWizardValidation';

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

const exportComponentKeysHelperText = 'Her satırda bir component key.';

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
function friendlyWizardIssuePath(pathParts: (string | number)[]): string {
  const p = pathParts.map(String);
  if (p.length === 0) return 'Yapılandırma';

  const [a, b, c, d] = [p[0], p[1], p[2], p[3]];

  const rootFields = new Set([
    'version',
    'description',
    'domain',
    'runtimeVersion',
    'schemaVersion',
  ]);
  if (p.length === 1 && a && rootFields.has(a)) {
    return `Root kartı içindeki ${a} alanı`;
  }

  if (a === 'paths' && p.length === 2 && b) {
    return `Paths kartı içindeki ${b} alanı`;
  }

  if (a === 'referenceResolution' && b === 'allowedHosts') {
    return 'Reference resolution kartı içindeki allowedHosts alanı';
  }

  if (a === 'referenceResolution' && b === 'schemaValidationRules' && c) {
    return `Reference resolution kartı, schemaValidationRules içindeki ${c} alanı`;
  }

  if (a === 'exports' && b === 'metadata') {
    if (c === 'keywords' && (typeof d === 'number' || (typeof d === 'string' && /^\d+$/.test(d)))) {
      const idx = typeof d === 'number' ? d : Number(d);
      return `Exports kartı, metadata içindeki keywords (${idx + 1}. öğe)`;
    }
    if (c) {
      return `Exports kartı, metadata içindeki ${c} alanı`;
    }
  }

  if (p.length === 1 && a === 'allowedHosts') {
    return 'Reference resolution kartı içindeki allowedHosts alanı';
  }

  if (a === 'referenceResolution' && p.length >= 2) {
    return `Reference resolution kartı içindeki ${p.slice(1).join(' › ')} alanı`;
  }

  return p.join(' › ');
}

/** Mesajda tekrarlayan teknik path önekini kaldırır. */
function wizardIssueMessageForDisplay(message: string, pathParts: (string | number)[]): string {
  let m = message.trim();
  const joined = pathParts.join('.');
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
          'rounded-xl',
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
            className="w-full rounded-xl">
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
            className={cn('rounded-xl', errorText && 'ring-destructive/25 ring-2')}
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
                'min-h-20 resize-y rounded-xl font-mono text-sm leading-relaxed',
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

interface CreateVnextConfigDialogProps {
  projectId: string;
  defaultDomain: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: (nextProjectId: string) => void | Promise<void>;
}

export function CreateVnextConfigDialog({
  projectId,
  defaultDomain,
  open,
  onOpenChange,
  onCompleted,
}: CreateVnextConfigDialogProps) {
  const seed = useMemo((): VnextWorkspaceConfig => {
    const d = defaultDomain.trim() || 'workspace';
    return buildVnextWorkspaceConfig({
      domain: d,
      description: `${d} alan tanımı yapılandırması`,
      exportsMetadataDescription: `Exported components for ${d} domain`,
    });
  }, [defaultDomain]);

  const form = useForm<VnextWorkspaceConfig>({
    mode: 'onChange',
    defaultValues: seed,
  });

  const { register, control, handleSubmit, reset, setValue } = form;
  const domain = useWatch({ control, name: 'domain' });
  const watchedForm = useWatch({ control, defaultValue: seed });
  const [useCustomComponentsRoot, setUseCustomComponentsRoot] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);

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
        onOpenChange(false);
        await onCompleted(result.data.id);
      },
      successMessage: isEditMode
        ? 'vnext.config.json güncellendi.'
        : 'vnext.config.json oluşturuldu.',
    }),
    [isEditMode, onCompleted, onOpenChange],
  );

  const { execute: writeConfig, loading: writing } = useWriteVnextWorkspaceConfig(writeOptions);

  useEffect(() => {
    if (!open) {
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
      setValue('paths.componentsRoot', domain.trim(), { shouldDirty: false, shouldValidate: true });
    }
  }, [domain, setValue, useCustomComponentsRoot]);

  const onSubmit = handleSubmit(async (values) => {
    const normalized = normalizeVnextWizardPayload(values);
    const parsed = validateNormalizedVnextWizardPayload(normalized);
    if (!parsed.success) {
      return;
    }
    await writeConfig(projectId, parsed.data);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        variant="default"
        className="w-full max-w-[min(72rem,calc(100vw-1.5rem))] gap-0 rounded-2xl p-0 sm:max-w-[min(72rem,calc(100vw-1.5rem))]">
        <div className="flex max-h-[min(90vh,920px)] flex-col">
          <div className="my-1 shrink-0 space-y-2 rounded-xl px-6 py-5">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-primary-text">
                {isEditMode
                  ? 'vnext.config.json dosyası düzenleniyor'
                  : 'vnext.config.json dosyası gerekli'}
              </DialogTitle>
            </DialogHeader>
          </div>

          {loadingConfig ? (
            <div className="flex flex-1 items-center justify-center py-20">
              <Loader2 className="text-muted-foreground size-6 animate-spin" />
            </div>
          ) : null}

          <form
            className={cn('flex min-h-0 flex-1 flex-col', loadingConfig && 'hidden')}
            onSubmit={(e) => void onSubmit(e)}>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {!wizardValidation.success ? (
                <div
                  role="alert"
                  className="border-destructive-border bg-destructive/5 mb-6 rounded-xl border p-4">
                  <div className="text-destructive flex gap-2 text-sm">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <div className="min-w-0 space-y-2">
                      <p className="leading-snug font-semibold">
                        Zorunlu alanlar eksik veya geçersiz
                      </p>
                      <ul className="text-destructive/95 max-h-40 list-inside list-disc overflow-y-auto text-xs leading-relaxed">
                        {Array.from(
                          new Set(
                            wizardValidation.error.issues.map((i) => {
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
              <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="min-w-0 space-y-6">
                  <Card variant="secondary" hoverable={false} className="gap-4 py-5 shadow-none">
                    <CardHeader className="px-5 pb-0">
                      <CardTitle className="font-mono text-sm font-medium">Root</CardTitle>
                    </CardHeader>
                    <CardContent className="grid min-w-0 grid-cols-1 gap-4 px-5 sm:grid-cols-2">
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

                  <Card variant="secondary" hoverable={false} className="gap-4 py-5 shadow-none">
                    <CardHeader className="px-5 pb-0">
                      <CardTitle className="font-mono text-sm font-medium">paths</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 px-5">
                      <label className="text-foreground flex cursor-pointer items-center gap-2 text-sm leading-normal font-medium">
                        <Checkbox
                          checked={useCustomComponentsRoot}
                          onCheckedChange={(v) => setUseCustomComponentsRoot(v === true)}
                        />
                        <span className="font-mono">Özel componentsRoot kullan</span>
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
                              'rounded-xl',
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

                  <Card variant="secondary" hoverable={false} className="gap-4 py-5 shadow-none">
                    <CardHeader className="px-5 pb-0">
                      <CardTitle className="font-mono text-sm font-medium">dependencies</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 px-5">
                      <JsonTagField
                        label="domains"
                        control={control}
                        name="dependencies.domains"
                        placeholder="domain key…"
                      />
                      <JsonTagField
                        label="npm"
                        control={control}
                        name="dependencies.npm"
                        placeholder="package spec…"
                      />
                    </CardContent>
                  </Card>

                  <Card variant="secondary" hoverable={false} className="gap-4 py-5 shadow-none">
                    <CardHeader className="px-5 pb-0">
                      <CardTitle className="font-mono text-sm font-medium">
                        referenceResolution
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 px-5">
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
                        helperText="Her satırda bir hostname."
                        errorText={pickWizardFieldError(
                          fieldIssues,
                          'referenceResolution.allowedHosts',
                        )}
                      />

                      <Card variant="tertiary" hoverable={false} className="gap-3 py-4 shadow-none">
                        <CardHeader className="px-4 pb-0">
                          <CardTitle className="text-tertiary-text font-mono text-xs leading-snug font-medium">
                            schemaValidationRules
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="grid min-w-0 grid-cols-1 gap-4 px-4 sm:grid-cols-2">
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

                <div className="min-w-0 space-y-6">
                  <Card variant="secondary" hoverable={false} className="gap-4 py-5 shadow-none">
                    <CardHeader className="px-5 pb-0">
                      <CardTitle className="font-mono text-sm font-medium">exports</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 px-5">
                      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="min-w-0 sm:col-span-2">
                          <JsonStringArrayLinesField
                            label="functions"
                            control={control}
                            name="exports.functions"
                            placeholder="my-function-key"
                            helperText={exportComponentKeysHelperText}
                          />
                        </div>
                        <div className="min-w-0 sm:col-span-2">
                          <JsonStringArrayLinesField
                            label="workflows"
                            control={control}
                            name="exports.workflows"
                            placeholder="my-workflow-key"
                            helperText={exportComponentKeysHelperText}
                          />
                        </div>
                        <div className="min-w-0 sm:col-span-2">
                          <JsonStringArrayLinesField
                            label="tasks"
                            control={control}
                            name="exports.tasks"
                            placeholder="my-task-key"
                            helperText={exportComponentKeysHelperText}
                          />
                        </div>
                        <div className="min-w-0 sm:col-span-2">
                          <JsonStringArrayLinesField
                            label="views"
                            control={control}
                            name="exports.views"
                            placeholder="my-view-key"
                            helperText={exportComponentKeysHelperText}
                          />
                        </div>
                        <div className="min-w-0 sm:col-span-2">
                          <JsonStringArrayLinesField
                            label="schemas"
                            control={control}
                            name="exports.schemas"
                            placeholder="my-schema-key"
                            helperText={exportComponentKeysHelperText}
                          />
                        </div>
                        <div className="min-w-0 sm:col-span-2">
                          <JsonStringArrayLinesField
                            label="extensions"
                            control={control}
                            name="exports.extensions"
                            placeholder="my-extension-key"
                            helperText={exportComponentKeysHelperText}
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
                                  e.target
                                    .value as VnextWorkspaceConfig['exports']['visibility'],
                                )
                              }
                              variant="default"
                              hoverable={false}
                              className="w-full rounded-xl">
                              <option value="public">public</option>
                              <option value="private">private</option>
                            </Select>
                          </JsonFieldShell>
                        )}
                      />

                      <Card variant="tertiary" hoverable={false} className="gap-3 py-4 shadow-none">
                        <CardHeader className="px-4 pb-0">
                          <CardTitle className="text-tertiary-text font-mono text-xs font-medium">
                            metadata
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 px-4">
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
                              errorText={pickWizardFieldError(
                                fieldIssues,
                                'exports.metadata.license',
                              )}
                            />
                          </div>
                          <div className="min-w-0">
                            <JsonTagField
                              label="keywords"
                              control={control}
                              name="exports.metadata.keywords"
                              placeholder="keyword…"
                              errorText={pickWizardFieldError(
                                fieldIssues,
                                'exports.metadata.keywords',
                              )}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>

            <DialogFooter className="border-border-subtle shrink-0 gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end">
              <DialogCancelButton type="button" variant="secondary" className="rounded-xl">
                Kapat
              </DialogCancelButton>
              <Button
                type="submit"
                variant="success"
                className="rounded-xl"
                loading={writing}
                disabled={!wizardValidation.success}>
                {isEditMode ? 'Güncelle ve kaydet' : 'Oluştur ve kaydet'}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
