import { X } from 'lucide-react';
import type { WorkflowMetaView, ComponentRef, TransitionView } from './view-types';
import { Section, InfoRow, Badge, ResourceRef, LabelList } from '../components/panels/tabs/PropertyPanelShared';
import { TransitionFields } from './TransitionFields';

function RefList({ refs }: { refs: ComponentRef[] }) {
  return (
    <div className="space-y-2">
      {refs.map((r, i) => (
        <div key={i} className="rounded-xl border border-border bg-surface p-2.5">
          <ResourceRef resource={r} />
        </div>
      ))}
    </div>
  );
}

function WfTransitionSection({ title, transition }: { title: string; transition: TransitionView }) {
  return (
    <Section title={title} defaultOpen={false}>
      <TransitionFields transition={transition} />
    </Section>
  );
}

export interface WorkflowMetadataInspectorProps {
  workflow: WorkflowMetaView;
  onClose?: () => void;
}

export function WorkflowMetadataInspector({ workflow: w, onClose }: WorkflowMetadataInspectorProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border-subtle bg-surface px-3 py-2">
        <span className="text-foreground text-[13px] font-bold tracking-tight">Workflow Settings</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 rounded-md p-1 transition-colors"
            aria-label="Close panel">
            <X size={14} strokeWidth={2} aria-hidden />
          </button>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        <Section title="Basic" defaultOpen>
          <div className="space-y-1.5">
            <InfoRow label="Key" value={w.key} mono copyable />
            {w.domain && <InfoRow label="Domain" value={w.domain} mono />}
            {w.version && <InfoRow label="Version" value={w.version} mono />}
            {w.flow && <InfoRow label="Flow" value={w.flow} mono />}
            {w.type && <InfoRow label="Type" value={w.type} mono />}
            {w.comment && <InfoRow label="Description" value={w.comment} />}
          </div>
          {w.tags && w.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {w.tags.map((t) => <Badge key={t} className="bg-muted text-muted-foreground">{t}</Badge>)}
            </div>
          )}
        </Section>

        {w.labels && w.labels.length > 0 && (
          <Section title="Labels" count={w.labels.length} defaultOpen={false}>
            <LabelList labels={w.labels} />
          </Section>
        )}

        {w.schema && (
          <Section title="Schema" defaultOpen={false}><ResourceRef resource={w.schema} /></Section>
        )}

        {w.queryRoles && w.queryRoles.length > 0 && (
          <Section title="Query Roles" count={w.queryRoles.length} defaultOpen={false}>
            <div className="flex flex-wrap gap-1.5">
              {w.queryRoles.map((r, i) => (
                <Badge key={i} className="bg-muted text-muted-foreground">{r.role}{r.grant ? ` (${r.grant})` : ''}</Badge>
              ))}
            </div>
          </Section>
        )}

        {w.updateData && <WfTransitionSection title="Update Data" transition={w.updateData} />}
        {w.cancel && <WfTransitionSection title="Cancel" transition={w.cancel} />}
        {w.exit && <WfTransitionSection title="Exit" transition={w.exit} />}
        {w.timeout && <WfTransitionSection title="Timeout" transition={w.timeout} />}

        {w.sharedTransitions && w.sharedTransitions.length > 0 && (
          <Section title="Shared Transitions" count={w.sharedTransitions.length} defaultOpen={false}>
            <div className="space-y-2">
              {w.sharedTransitions.map((t, i) => (
                <Section key={i} title={t.key || 'unnamed'} defaultOpen={false}>
                  <TransitionFields transition={t} />
                </Section>
              ))}
            </div>
          </Section>
        )}

        {w.functions && w.functions.length > 0 && (
          <Section title="Functions" count={w.functions.length} defaultOpen={false}><RefList refs={w.functions} /></Section>
        )}
        {w.extensions && w.extensions.length > 0 && (
          <Section title="Extensions" count={w.extensions.length} defaultOpen={false}><RefList refs={w.extensions} /></Section>
        )}
      </div>
    </div>
  );
}
