import { AlertTriangle, CheckCircle2, Loader2, Terminal, X } from 'lucide-react';

import { cn, Popover, PopoverContent, PopoverTrigger, useProjectStore, useRuntimeStore, useValidationStore } from '@vnext-forge-studio/designer-ui';

import { StatusBarNotification, statusBarNotificationVariants } from './StatusBarNotification';
import { useEnvironmentStore } from '../../store/useEnvironmentStore';
import { useCliOutputStore } from '../../store/useCliOutputStore';
import { useVnextWorkspaceUiStore } from '../../store/useVnextWorkspaceUiStore';
import { useWebShellStore } from '../../store/useWebShellStore';
import { useWorkspaceDiagnosticsStore } from '../../store/useWorkspaceDiagnosticsStore';
import {
  StatusBarWorkspaceIssuesPopover,
  type WorkspaceIssuePopoverItem,
} from './StatusBarWorkspaceIssuesPopover';

function CliOutputChip() {
  const runningCommand = useCliOutputStore((s) => s.runningCommand);
  const lastOutput = useCliOutputStore((s) => s.lastOutput);
  const popoverOpen = useCliOutputStore((s) => s.popoverOpen);
  const setPopoverOpen = useCliOutputStore((s) => s.setPopoverOpen);
  const clearOutput = useCliOutputStore((s) => s.clearOutput);

  if (runningCommand) {
    return (
      <StatusBarNotification
        variant="chip-muted"
        leading={<Loader2 className="size-3 shrink-0 animate-spin" aria-hidden />}>
        {runningCommand}...
      </StatusBarNotification>
    );
  }

  if (!lastOutput) return null;

  const ok = lastOutput.exitCode === 0;

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            statusBarNotificationVariants({
              variant: ok ? 'chip-success' : 'chip-danger',
              interactive: true,
            }),
          )}>
          <Terminal className="size-3 shrink-0" aria-hidden />
          {ok ? 'CLI: OK' : 'CLI: Failed'}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={8}
        className="w-96 max-w-[90vw]">
        <div className="flex flex-col">
          <header className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-semibold text-foreground">CLI Output</span>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground rounded p-0.5"
              onClick={() => clearOutput()}
              aria-label="Dismiss CLI output">
              <X className="size-3.5" />
            </button>
          </header>
          <div className="flex flex-col gap-1 px-3 py-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-mono text-muted-foreground">{lastOutput.command}</span>
              <span className={cn('font-mono text-[10px]', ok ? 'text-emerald-500' : 'text-red-400')}>
                exit {lastOutput.exitCode}
              </span>
            </div>
            {lastOutput.stdout ? (
              <pre className="max-h-[200px] overflow-auto rounded bg-[#0f0f12] p-2 font-mono text-[10px] leading-relaxed text-neutral-100 select-text whitespace-pre-wrap break-all">
                {lastOutput.stdout}
              </pre>
            ) : null}
            {lastOutput.stderr ? (
              <pre className="max-h-[120px] overflow-auto rounded bg-[#0f0f12] p-2 font-mono text-[10px] leading-relaxed text-red-400 select-text whitespace-pre-wrap break-all">
                {lastOutput.stderr}
              </pre>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function StatusBar() {
  const { activeProject, vnextConfig } = useProjectStore();
  const showMissingVnextConfigBar = useVnextWorkspaceUiStore((s) => s.showMissingVnextConfigBar);
  const setVnextConfigWizardOpen = useVnextWorkspaceUiStore((s) => s.setVnextConfigWizardOpen);
  const componentLayoutStatus = useVnextWorkspaceUiStore((s) => s.componentLayoutStatus);
  const openTemplateSeedDialog = useVnextWorkspaceUiStore((s) => s.openTemplateSeedDialog);
  const focusSettingsAccordionSection = useWebShellStore((s) => s.focusSettingsAccordionSection);
  const { connected, healthStatus } = useRuntimeStore();
  const activeEnvironment = useEnvironmentStore((s) =>
    !s.activeEnvironmentId
      ? null
      : (s.environments.find((e) => e.id === s.activeEnvironmentId) ?? null),
  );
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

  const { runtimeIndicatorClass, runtimeLabel, runtimeChipVariant } = ((): {
    runtimeIndicatorClass: string;
    runtimeLabel: string;
    runtimeChipVariant: 'chip-success' | 'chip-warning' | 'chip-muted';
  } => {
    if (!activeEnvironment) {
      return {
        runtimeIndicatorClass: 'bg-brand-surface-dot-warning',
        runtimeLabel: 'No Environment',
        runtimeChipVariant: 'chip-warning' as const,
      };
    }
    if (connected) {
      return {
        runtimeIndicatorClass: 'bg-brand-surface-dot-success',
        runtimeLabel: `${activeEnvironment.name} Connected`,
        runtimeChipVariant: 'chip-success' as const,
      };
    }
    if (healthStatus === 'unhealthy') {
      return {
        runtimeIndicatorClass: 'bg-brand-surface-dot-warning',
        runtimeLabel: `${activeEnvironment.name} Offline`,
        runtimeChipVariant: 'chip-warning' as const,
      };
    }
    return {
      runtimeIndicatorClass: 'bg-brand-surface-dot-idle',
      runtimeLabel: activeEnvironment.name,
      runtimeChipVariant: 'chip-muted' as const,
    };
  })();

  return (
    <div className="bg-brand-surface text-brand-surface-foreground flex h-7 shrink-0 items-center gap-3 px-4 text-[11px] select-none">
      <span className="text-brand-surface-strong font-semibold">
        {activeProject ? activeProject.domain : 'Flow Studio'}
      </span>

      <span className="flex-1" />

      {totalErrors > 0 ? <StatusBarWorkspaceIssuesPopover items={errorPopoverItems} /> : null}

      <CliOutputChip />

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

      {activeEnvironment ? (
        <StatusBarNotification
          variant={runtimeChipVariant}
          leading={<span className={`h-2 w-2 shrink-0 rounded-full ${runtimeIndicatorClass}`} />}>
          {runtimeLabel}
        </StatusBarNotification>
      ) : (
        <StatusBarNotification
          asButton
          type="button"
          variant={runtimeChipVariant}
          leading={<span className={`h-2 w-2 shrink-0 rounded-full ${runtimeIndicatorClass}`} />}
          onClick={() => focusSettingsAccordionSection(['environments'])}
          aria-label="No environment configured. Open Settings, Environments.">
          {runtimeLabel}
        </StatusBarNotification>
      )}
    </div>
  );
}
