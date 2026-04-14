import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Control, Path, UseFormRegister } from 'react-hook-form';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
  buildVnextWorkspaceConfig,
  isSuccess,
  type ApiResponse,
  type VnextWorkspaceConfigJson,
} from '@vnext-forge/app-contracts';

import type { ProjectInfo } from '@modules/project-management/ProjectTypes';
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

import { useWriteVnextWorkspaceConfig } from '../hooks/useWriteVnextWorkspaceConfig';

function stringArrayToMultiline(value: unknown): string {
  if (!Array.isArray(value)) return '';
  return value.map((item) => String(item)).join('\n');
}

/** Boş satırları silme: Enter ile yeni satır `""` öğesi olarak kalır; yalnızca satır içi trim. */
function multilineToStringArray(text: string): string[] {
  if (text === '') return [];
  return text.split('\n').map((line) => line.trim());
}

/** Kayıt öncesi: yalnızca boş / whitespace satırlarını at (düzenleme sırasında Enter ile oluşan `""`). */
function compactNonEmptyLines(items: string[] | undefined): string[] {
  return (items ?? []).map((s) => s.trim()).filter((s) => s.length > 0);
}

const exportComponentKeysHelperText = 'Her satırda bir component key.';

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
}: {
  label: string;
  register: UseFormRegister<VnextWorkspaceConfigJson>;
  name: Path<VnextWorkspaceConfigJson>;
  placeholder?: string;
  className?: string;
}) {
  return (
    <JsonFieldShell label={label}>
      <Input
        {...register(name)}
        placeholder={placeholder}
        variant="default"
        hoverable={false}
        className={cn('rounded-xl', className)}
      />
    </JsonFieldShell>
  );
}

function JsonBoolField({
  label,
  control,
  name,
}: {
  label: string;
  control: Control<VnextWorkspaceConfigJson>;
  name: Path<VnextWorkspaceConfigJson>;
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
}: {
  label: string;
  control: Control<VnextWorkspaceConfigJson>;
  name: Path<VnextWorkspaceConfigJson>;
  placeholder?: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <JsonFieldShell label={label}>
          <TagEditor
            tags={Array.isArray(field.value) ? (field.value as string[]) : []}
            onChange={field.onChange}
            placeholder={placeholder ?? 'Add item…'}
            variant="default"
            hoverable={false}
            className="rounded-xl"
          />
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
}: {
  label: string;
  control: Control<VnextWorkspaceConfigJson>;
  name: Path<VnextWorkspaceConfigJson>;
  placeholder?: string;
  helperText?: string;
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
              className="min-h-20 resize-y rounded-xl font-mono text-sm leading-relaxed"
              spellCheck={false}
            />
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
  const seed = useMemo((): VnextWorkspaceConfigJson => {
    const d = defaultDomain.trim() || 'workspace';
    return buildVnextWorkspaceConfig({
      domain: d,
      description: `${d} alan tanımı yapılandırması`,
      exportsMetadataDescription: `Exported components for ${d} domain`,
    });
  }, [defaultDomain]);

  const form = useForm<VnextWorkspaceConfigJson>({
    mode: 'onChange',
    defaultValues: seed,
  });

  const { register, control, handleSubmit, reset, setValue } = form;
  const domain = useWatch({ control, name: 'domain' });
  const [useCustomComponentsRoot, setUseCustomComponentsRoot] = useState(false);

  const writeOptions = useMemo(
    () => ({
      onSuccess: async (result: ApiResponse<ProjectInfo>) => {
        if (!isSuccess(result)) return;
        onOpenChange(false);
        await onCompleted(result.data.id);
      },
    }),
    [onCompleted, onOpenChange],
  );

  const { execute: writeConfig, loading: writing } = useWriteVnextWorkspaceConfig(writeOptions);

  useEffect(() => {
    if (!open) {
      return;
    }
    setUseCustomComponentsRoot(false);
    reset(seed);
  }, [open, reset, seed]);

  useEffect(() => {
    if (!useCustomComponentsRoot && domain) {
      setValue('paths.componentsRoot', domain.trim(), { shouldDirty: false, shouldValidate: true });
    }
  }, [domain, setValue, useCustomComponentsRoot]);

  const onSubmit = handleSubmit(async (values) => {
    await writeConfig(projectId, {
      ...values,
      referenceResolution: {
        ...values.referenceResolution,
        allowedHosts: compactNonEmptyLines(values.referenceResolution.allowedHosts),
      },
      exports: {
        ...values.exports,
        functions: compactNonEmptyLines(values.exports.functions),
        workflows: compactNonEmptyLines(values.exports.workflows),
        tasks: compactNonEmptyLines(values.exports.tasks),
        views: compactNonEmptyLines(values.exports.views),
        schemas: compactNonEmptyLines(values.exports.schemas),
        extensions: compactNonEmptyLines(values.exports.extensions),
      },
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        variant="default"
        className="w-full max-w-[min(72rem,calc(100vw-1.5rem))] gap-0 rounded-2xl p-0 sm:max-w-[min(72rem,calc(100vw-1.5rem))]">
        <div className="flex max-h-[min(90vh,920px)] flex-col">
          <div className="m-2 shrink-0 space-y-2 rounded-xl px-6 py-5">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-primary-text">vnext.config.json gerekli</DialogTitle>
              <DialogDescription className="text-primary-text leading-relaxed">
                Proje kökünde yapılandırma dosyası bulunamadı. Alanlar vnext.config.json yapısıyla
                uyumludur; kart başlıkları hangi nesneyi düzenlediğinizi gösterir. Varsayılanlar
                doldurulmuştur, istediğiniz gibi düzenleyebilirsiniz.
              </DialogDescription>
            </DialogHeader>
          </div>

          <form className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => void onSubmit(e)}>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="min-w-0 space-y-6">
                  <Card variant="secondary" hoverable={false} className="gap-4 py-5 shadow-none">
                    <CardHeader className="px-5 pb-0">
                      <CardTitle className="font-mono text-sm font-medium">Root</CardTitle>
                    </CardHeader>
                    <CardContent className="grid min-w-0 grid-cols-1 gap-4 px-5 sm:grid-cols-2">
                      <JsonTextField label="version" register={register} name="version" />
                      <JsonTextField label="domain" register={register} name="domain" />
                      <JsonTextField
                        label="description"
                        register={register}
                        name="description"
                        className="sm:col-span-2"
                      />
                      <JsonTextField
                        label="runtimeVersion"
                        register={register}
                        name="runtimeVersion"
                      />
                      <JsonTextField
                        label="schemaVersion"
                        register={register}
                        name="schemaVersion"
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
                            className="rounded-xl"
                          />
                        </JsonFieldShell>
                        <JsonTextField label="tasks" register={register} name="paths.tasks" />
                        <JsonTextField label="views" register={register} name="paths.views" />
                        <JsonTextField
                          label="functions"
                          register={register}
                          name="paths.functions"
                        />
                        <JsonTextField
                          label="extensions"
                          register={register}
                          name="paths.extensions"
                        />
                        <JsonTextField
                          label="workflows"
                          register={register}
                          name="paths.workflows"
                        />
                        <JsonTextField label="schemas" register={register} name="paths.schemas" />
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
                                    .value as VnextWorkspaceConfigJson['exports']['visibility'],
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
                          />
                          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                            <JsonTextField
                              label="maintainer"
                              register={register}
                              name="exports.metadata.maintainer"
                            />
                            <JsonTextField
                              label="license"
                              register={register}
                              name="exports.metadata.license"
                            />
                          </div>
                          <div className="min-w-0">
                            <JsonTagField
                              label="keywords"
                              control={control}
                              name="exports.metadata.keywords"
                              placeholder="keyword…"
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
              <Button type="submit" variant="success" className="rounded-xl" loading={writing}>
                Oluştur ve kaydet
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
