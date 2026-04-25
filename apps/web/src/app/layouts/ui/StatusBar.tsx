import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { useProjectStore, useRuntimeStore, useValidationStore } from '@vnext-forge/designer-ui';

import { StatusBarNotification } from './StatusBarNotification';
import { useVnextWorkspaceUiStore } from '../../store/useVnextWorkspaceUiStore';
import { useWorkspaceDiagnosticsStore } from '../../store/useWorkspaceDiagnosticsStore';
import {
  StatusBarWorkspaceIssuesPopover,
  type WorkspaceIssuePopoverItem,
} from './StatusBarWorkspaceIssuesPopover';

export function StatusBar() {
  const { activeProject, vnextConfig } = useProjectStore();
  const showMissingVnextConfigBar = useVnextWorkspaceUiStore((s) => s.showMissingVnextConfigBar);
  const setVnextConfigWizardOpen = useVnextWorkspaceUiStore((s) => s.setVnextConfigWizardOpen);
  const componentLayoutStatus = useVnextWorkspaceUiStore((s) => s.componentLayoutStatus);
  const openTemplateSeedDialog = useVnextWorkspaceUiStore((s) => s.openTemplateSeedDialog);
  const { connected, healthStatus } = useRuntimeStore();
  const { issues } = useValidationStore();
  const { configIssues } = useWorkspaceDiagnosticsStore();
  const invalidVnextConfigIssue = configIssues.find((i) => i.id === 'workspace-config-invalid');

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
    queueMicrotask(() => {
      const layout = useVnextWorkspaceUiStore.getState().componentLayoutStatus;
      if (!layout) return;
      const reason = layout.projectContainsOnlyConfigFile ? 'only_config' : 'incomplete_layout';
      openTemplateSeedDialog(reason, layout.missingLayoutPaths);
    });
  };

  const mergedIssues = [...issues, ...configIssues];
  const errorIssues = mergedIssues.filter((issue) => issue.severity === 'error');
  const warnings = mergedIssues.filter((issue) => issue.severity === 'warning').length;

  const configActionIds = new Set<string>();
  if (invalidVnextConfigIssue) configActionIds.add(invalidVnextConfigIssue.id);

  const showTemplateSeedIssue =
    templateBarBase && componentLayoutStatus != null && !componentLayoutStatus.layoutComplete;

  const missingPaths = componentLayoutStatus?.missingLayoutPaths ?? [];

  const errorPopoverItems: WorkspaceIssuePopoverItem[] = [
    ...(activeProject && !invalidVnextConfigIssue && showMissingVnextConfigBar
      ? [
          {
            id: 'missing-vnext-config',
            message: 'vnext.config.json not found',
            action: { label: 'Create', onClick: () => setVnextConfigWizardOpen(true) },
          },
        ]
      : []),
    ...errorIssues.map((issue) => ({
      id: issue.id,
      message: issue.message,
      detail: [issue.path, issue.rule].filter(Boolean).join(' · ') || undefined,
      action: configActionIds.has(issue.id)
        ? { label: 'Fix', onClick: () => setVnextConfigWizardOpen(true) }
        : undefined,
    })),
    ...(showTemplateSeedIssue
      ? [
          {
            id: 'missing-component-layout',
            message: componentLayoutStatus?.projectContainsOnlyConfigFile
              ? `Component folders are missing\n${missingPaths.slice(0, 8).join('\n')}`
              : `Some component folders are missing\n${missingPaths.slice(0, 8).join('\n')}`,
            detail: 'workspace.layout',
            action: {
              label: 'Create',
              onClick: () => openTemplateDialogFromLayout(),
            },
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

      {totalErrors > 0 ? <StatusBarWorkspaceIssuesPopover items={errorPopoverItems} /> : null}

      {warnings > 0 && (
        <StatusBarNotification
          variant="chip-warning"
          leading={<AlertTriangle className="size-3.5 shrink-0" />}>
          {warnings} {warnings === 1 ? 'Warning' : 'Warnings'}
        </StatusBarNotification>
      )}

      {totalErrors === 0 && warnings === 0 && activeProject && !needsTemplateOffer && (
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
