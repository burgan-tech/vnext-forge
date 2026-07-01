import type { ReactNode } from 'react';
import type { TransitionView, ViewBindingView, TaskRefView } from './view-types';
import { Section, InfoRow, Badge, ResourceRef, CodePreview, LabelList } from '../components/panels/tabs/PropertyPanelShared';
import { getTriggerLabel, getTriggerKindLabel } from '../components/panels/tabs/PropertyPanelHelpers';

function ViewBindingRows({ binding }: { binding: ViewBindingView }) {
  return (
    <div className="space-y-1">
      <ResourceRef resource={binding.view} />
      {binding.extensions && binding.extensions.length > 0 && (
        <InfoRow label="Extensions" value={binding.extensions.join(', ')} mono />
      )}
    </div>
  );
}

function TaskRefRow({ task }: { task: TaskRefView }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-2.5 space-y-1.5">
      <ResourceRef resource={task.ref} />
      {task.comment && <InfoRow label="Note" value={task.comment} />}
      {task.mapping && <CodePreview code={task.mapping.code ?? ''} location={task.mapping.location} />}
      {task.hasErrorBoundary && <Badge className="bg-muted text-muted-foreground">Error boundary</Badge>}
    </div>
  );
}

/** Read-only body of a transition. Reused by TransitionInspector and the state Transitions tab. */
export function TransitionFields({ transition: t }: { transition: TransitionView }): ReactNode {
  return (
    <div className="space-y-2">
      <InfoRow label="Target" value={t.target || '—'} mono />
      {t.triggerType != null && <InfoRow label="Trigger" value={getTriggerLabel(t.triggerType)} />}
      {t.triggerKind != null && t.triggerKind !== 0 && (
        <InfoRow label="Trigger kind" value={getTriggerKindLabel(t.triggerKind)} />
      )}
      {t.comment && <InfoRow label="Description" value={t.comment} />}

      {t.tasks && t.tasks.length > 0 && (
        <Section title="On Execution Tasks" count={t.tasks.length} defaultOpen={false}>
          <div className="space-y-2">
            {t.tasks.map((task, i) => <TaskRefRow key={i} task={task} />)}
          </div>
        </Section>
      )}

      {t.schema && (
        <Section title="Schema" defaultOpen={false}>
          <ResourceRef resource={t.schema} />
        </Section>
      )}

      {t.mapping && (
        <Section title="Mapping" defaultOpen={false}>
          <CodePreview code={t.mapping.code ?? ''} location={t.mapping.location} />
        </Section>
      )}
      {t.rule && (
        <Section title="Condition" defaultOpen={false}>
          <CodePreview code={t.rule.code ?? ''} location={t.rule.location} />
        </Section>
      )}
      {t.timer && (
        <Section title="Timer" defaultOpen={false}>
          <CodePreview code={t.timer.code ?? ''} location={t.timer.location} />
        </Section>
      )}

      {t.roles && t.roles.length > 0 && (
        <Section title="Roles" count={t.roles.length} defaultOpen={false}>
          <div className="flex flex-wrap gap-1.5">
            {t.roles.map((r, i) => (
              <Badge key={i} className="bg-muted text-muted-foreground">{r.role}{r.grant ? ` (${r.grant})` : ''}</Badge>
            ))}
          </div>
        </Section>
      )}

      {(t.view || (t.views && t.views.length > 0)) && (
        <Section title="Views" count={t.views?.length ?? (t.view ? 1 : 0)} defaultOpen={false}>
          <div className="space-y-2">
            {t.view && <ViewBindingRows binding={t.view} />}
            {t.views?.map((v, i) => <ViewBindingRows key={i} binding={v} />)}
          </div>
        </Section>
      )}

      {t.availableIn && t.availableIn.length > 0 && (
        <InfoRow label="Available in" value={t.availableIn.join(', ')} mono />
      )}

      {t.labels && t.labels.length > 0 && (
        <Section title="Labels" count={t.labels.length} defaultOpen={false}>
          <LabelList labels={t.labels} />
        </Section>
      )}

      {t.annotations && Object.keys(t.annotations).length > 0 && (
        <Section title="Annotations" count={Object.keys(t.annotations).length} defaultOpen={false}>
          <div className="space-y-1">
            {Object.entries(t.annotations).map(([k, v]) => <InfoRow key={k} label={k} value={String(v)} mono />)}
          </div>
        </Section>
      )}
    </div>
  );
}
