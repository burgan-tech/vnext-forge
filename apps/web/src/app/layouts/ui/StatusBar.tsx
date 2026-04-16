import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { useProjectStore } from '@app/store/useProjectStore';
import { useRuntimeStore } from '@app/store/useRuntimeStore';
import { useValidationStore } from '@app/store/useValidationStore';
import { useVnextWorkspaceUiStore } from '@app/store/useVnextWorkspaceUiStore';
import { useWorkspaceDiagnosticsStore } from '@app/store/useWorkspaceDiagnosticsStore';
import { useWorkflowStore } from '@app/store/useWorkflowStore';
import { useEditorValidationStore } from '@app/store/useEditorValidationStore';
import {
  StatusBarErrorIssuesPopover,
  type ErrorPopoverItem,
} from '@app/layouts/ui/StatusBarErrorIssuesPopover';
import { StatusBarNotification } from '@shared/ui/StatusBarNotification';

export function StatusBar() {
  const { activeProject, vnextConfig } = useProjectStore();
  const showMissingVnextConfigBar = useVnextWorkspaceUiStore((s) => s.showMissingVnextConfigBar);
  const setVnextConfigWizardOpen = useVnextWorkspaceUiStore((s) => s.setVnextConfigWizardOpen);
  const componentLayoutStatus = useVnextWorkspaceUiStore((s) => s.componentLayoutStatus);
  const openTemplateSeedDialog = useVnextWorkspaceUiStore((s) => s.openTemplateSeedDialog);
  const { connected, healthStatus } = useRuntimeStore();
  const { isDirty } = useWorkflowStore();
  const { issues } = useValidationStore();
  const { configIssues } = useWorkspaceDiagnosticsStore();
  const invalidVnextConfigIssue = configIssues.find((i) => i.id === 'workspace-config-invalid');
  const validateScriptMissing = useVnextWorkspaceUiStore((s) => s.validateScriptMissing);
  const { activeFileMarkers } = useEditorValidationStore();

  const needsTemplateOffer =
    componentLayoutStatus != null &&
    (!componentLayoutStatus.layoutComplete || componentLayoutStatus.projectContainsOnlyConfigFile);

  const templateBarBase =
    Boolean(activeProject) &&
    Boolean(vnextConfig) &&
    !invalidVnextConfigIssue &&
    !showMissingVnextConfigBar &&
    needsTemplateOffer;

  const openTemplateDialogFromLayout = () => {
    const layout = useVnextWorkspaceUiStore.getState().componentLayoutStatus;
    if (!layout) return;
    const reason = layout.projectContainsOnlyConfigFile ? 'only_config' : 'incomplete_layout';
    setTimeout(() => {
      openTemplateSeedDialog(reason, layout.missingLayoutPaths);
    }, 0);
  };

  const mergedIssues = [...issues, ...configIssues];
  const errorIssues = mergedIssues.filter((issue) => issue.severity === 'error');
  const baseWarnings = mergedIssues.filter((issue) => issue.severity === 'warning').length;

  const configActionIds = new Set<string>();
  if (invalidVnextConfigIssue) configActionIds.add(invalidVnextConfigIssue.id);

  const showTemplateSeedIssue =
    templateBarBase && componentLayoutStatus != null && !componentLayoutStatus.layoutComplete;

  const missingPaths = componentLayoutStatus?.missingLayoutPaths ?? [];

  const editorSchemaErrors = activeFileMarkers.filter((m) => m.severity === 'error');
  const editorSchemaWarnings = activeFileMarkers.filter((m) => m.severity === 'warning');

  const errorPopoverItems: ErrorPopoverItem[] = [
    ...(activeProject && !invalidVnextConfigIssue && showMissingVnextConfigBar
      ? [
          {
            id: 'missing-vnext-config',
            message: 'vnext.config.json bulunamadı',
            action: { label: 'Oluştur', onClick: () => setVnextConfigWizardOpen(true) },
          },
        ]
      : []),
    ...errorIssues.map((issue) => ({
      id: issue.id,
      message: issue.message,
      detail: [issue.path, issue.rule].filter(Boolean).join(' · ') || undefined,
      action: configActionIds.has(issue.id)
        ? { label: 'Düzelt', onClick: () => setVnextConfigWizardOpen(true) }
        : undefined,
    })),
    ...editorSchemaErrors.map((marker, idx) => ({
      id: `schema-error-${idx}`,
      message: marker.message,
      detail: `Satır ${marker.startLineNumber}:${marker.startColumn}`,
    })),
    ...(showTemplateSeedIssue
      ? [
          {
            id: 'missing-component-layout',
            message: componentLayoutStatus?.projectContainsOnlyConfigFile
              ? `Proje şablonu oluşturulmamış\n${missingPaths.join('\n')}`
              : `Proje yapısı eksik\n${missingPaths.join('\n')}`,
            detail: 'vnext-template',
            action: {
              label: 'Şablonu Oluştur',
              onClick: () => openTemplateDialogFromLayout(),
            },
          },
        ]
      : []),
    ...(activeProject && validateScriptMissing && !showTemplateSeedIssue
      ? [
          {
            id: 'missing-validate-script',
            message: 'validate.js dosyası bulunamadı. Proje şablonunu yeniden oluşturun.',
          },
        ]
      : []),
  ];
  const totalErrors = errorPopoverItems.length;
  const runtimeTone = connected ? 'success' : healthStatus === 'unhealthy' ? 'warning' : 'muted';
  const runtimeIndicatorClass = connected
    ? 'bg-brand-surface-dot-success'
    : healthStatus === 'unhealthy'
      ? 'bg-brand-surface-dot-warning'
      : 'bg-brand-surface-dot-idle';
  const runtimeLabel = connected
    ? 'Runtime Connected'
    : healthStatus === 'unhealthy'
      ? 'Runtime Offline'
      : 'Standalone Mode';
  const runtimeChipVariant =
    runtimeTone === 'success'
      ? 'chip-success'
      : runtimeTone === 'warning'
        ? 'chip-warning'
        : 'chip-muted';

  return (
    <div className="bg-brand-surface text-brand-surface-foreground flex h-7 shrink-0 items-center gap-3 px-4 text-[11px] select-none">
      <span className="text-brand-surface-strong font-semibold">
        {activeProject ? activeProject.domain : 'Flow Studio'}
      </span>

      <span className="flex-1" />

      {isDirty && (
        <StatusBarNotification
          variant="chip-warning"
          className="gap-1.5"
          leading={
            <span className="bg-brand-surface-dot-warning h-1.5 w-1.5 shrink-0 animate-pulse rounded-full" />
          }>
          Modified
        </StatusBarNotification>
      )}

      {totalErrors > 0 ? <StatusBarErrorIssuesPopover items={errorPopoverItems} /> : null}

      {(baseWarnings + editorSchemaWarnings.length) > 0 && (
        <StatusBarNotification
          variant="chip-warning"
          leading={<AlertTriangle className="size-3.5 shrink-0" />}>
          {baseWarnings + editorSchemaWarnings.length}{' '}
          {baseWarnings + editorSchemaWarnings.length === 1 ? 'Warning' : 'Warnings'}
        </StatusBarNotification>
      )}

      {totalErrors === 0 && baseWarnings + editorSchemaWarnings.length === 0 && activeProject && !needsTemplateOffer && (
        <StatusBarNotification
          variant="chip-success"
          leading={<CheckCircle2 className="size-3.5 shrink-0" />}>
          No Error
        </StatusBarNotification>
      )}

      <StatusBarNotification
        variant={runtimeChipVariant}
        leading={<span className={`h-2 w-2 shrink-0 rounded-full ${runtimeIndicatorClass}`} />}>
        {runtimeLabel}
      </StatusBarNotification>
    </div>
  );
}
