import type { ReactNode } from 'react';

import type { InstanceDetailResponse } from '../../quick-run/QuickRunApi';
import { DetailsList } from '../../quick-run/components/panel-kit';
import { artifactVersion, definitionDrift } from '../model/definitionDrift';

export interface InstanceTabProps {
  instance: InstanceDetailResponse;
  localVersion?: string;
  environmentName?: string;
  onOpenQuickRun?: () => void;
  onOpenFlowDesigner?: () => void;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-[10px] font-semibold uppercase text-[var(--vscode-descriptionForeground,#9d9d9d)]">{title}</h3>
      {children}
    </section>
  );
}

const when = (iso?: string) => (iso ? new Date(iso).toLocaleString() : undefined);

/** Instance metadata, grouped. Read-only; actions only navigate. */
export function InstanceTab({ instance, localVersion, environmentName, onOpenQuickRun, onOpenFlowDesigner }: InstanceTabProps) {
  const m = instance.metadata;
  const drift = definitionDrift(localVersion, instance.flowVersion);
  const version = artifactVersion(instance.flowVersion) ?? instance.flowVersion ?? '—';
  return (
    <div className="flex flex-col gap-3 p-3 text-[11px]">
      <Group title="Identity">
        <DetailsList
          rows={[
            { label: 'Key', value: instance.key, copy: instance.key, mono: true },
            { label: 'Id', value: instance.id, copy: instance.id, mono: true },
            { label: 'Flow', value: `${instance.domain}/${instance.flow}` },
            { label: 'Flow version', value: drift ? `${version} (local ${drift.localVersion})` : version },
            !!environmentName && { label: 'Environment', value: environmentName },
            !!instance.tags?.length && { label: 'Tags', value: instance.tags.join(', ') },
          ]}
        />
      </Group>
      <Group title="Status">
        <DetailsList
          rows={[
            { label: 'Status', value: m.status },
            !!m.effectiveStatus && m.effectiveStatus !== m.status && { label: 'Effective status', value: m.effectiveStatus },
            { label: 'Current state', value: m.currentState, mono: true },
            !!m.effectiveState && m.effectiveState !== m.currentState && {
              label: 'Effective state',
              value: `${m.effectiveState} (inside a subflow)`,
              mono: true,
            },
            !!m.currentStateType && {
              label: 'State type',
              value: m.currentStateSubType ? `${m.currentStateType} · ${m.currentStateSubType}` : m.currentStateType,
            },
            !!m.stage && { label: 'Stage', value: m.stage },
          ]}
        />
      </Group>
      <Group title="Timing">
        <DetailsList
          rows={[
            { label: 'Created', value: when(m.createdAt) ?? '—' },
            !!m.modifiedAt && { label: 'Modified', value: when(m.modifiedAt) },
          ]}
        />
      </Group>
      <Group title="Who">
        <DetailsList
          rows={[
            !!m.createdBy && { label: 'Created by', value: m.createdBy },
            !!m.createdByBehalfOf && { label: 'On behalf of', value: m.createdByBehalfOf },
            !!m.modifiedBy && { label: 'Modified by', value: m.modifiedBy },
            !!m.modifiedByBehalfOf && { label: 'Modified on behalf of', value: m.modifiedByBehalfOf },
          ]}
        />
      </Group>
      {(onOpenQuickRun ?? onOpenFlowDesigner) && (
        <div className="flex flex-wrap gap-2">
          {onOpenQuickRun && (
            <button type="button" onClick={onOpenQuickRun} className="cursor-pointer rounded border border-[var(--vscode-panel-border,#3c3c3c)] px-2 py-1 hover:bg-[var(--vscode-list-hoverBackground,#2a2d2e)]">
              Open in Quick Run
            </button>
          )}
          {onOpenFlowDesigner && (
            <button type="button" onClick={onOpenFlowDesigner} className="cursor-pointer rounded border border-[var(--vscode-panel-border,#3c3c3c)] px-2 py-1 hover:bg-[var(--vscode-list-hoverBackground,#2a2d2e)]">
              Open flow in designer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
