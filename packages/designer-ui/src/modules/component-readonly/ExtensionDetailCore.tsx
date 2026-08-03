import { useMemo } from 'react';

import { Badge } from '../../ui/Badge.js';
import { FormReadOnlyProvider } from '../../ui/FormReadOnlyContext.js';
import { normalizeDefinitionDoc } from './normalizeDefinitionDoc.js';
import { EXTENSION_SCOPE_LABELS, EXTENSION_TYPE_LABELS } from './readonlyLabels.js';
import { ComponentRefCard, type ComponentRef } from './shared/ComponentRefCard.js';
import { ReadOnlyMetadataSection } from './shared/ReadOnlyMetadataSection.js';
import { ReadOnlyScriptSection } from './shared/ReadOnlyScriptSection.js';
import { ReadOnlySectionCard } from './shared/ReadOnlySectionCard.js';
import { ReadOnlyValueField } from './shared/ReadOnlyValueField.js';
import { asTaskExecution } from './shared/readonlyGuards.js';
import { toDisplayText } from './shared/readonlyText.js';

// `attributes.task` arrives either editor-authored ({order, task, mapping})
// or as the reference directly (canonical template shape) — `asTaskExecution`
// normalizes both. It never carries an embedded task document.

/** Extension types that scope the extension to an explicit list of flows. */
const FLOW_SCOPED_TYPES = new Set([3, 4]);

export interface ExtensionDetailCoreProps {
  json: Record<string, unknown>;
  /** Invoked when the user clicks the referenced task (flow, ref). */
  onNavigateToComponent?: (flow: string, ref: ComponentRef) => void;
}

/** Read-only designer view of an extension component document. */
export function ExtensionDetailCore({
  json: raw,
  onNavigateToComponent,
}: ExtensionDetailCoreProps) {
  const json = useMemo(() => normalizeDefinitionDoc('extension', raw), [raw]);
  const attrs = (json.attributes ?? {}) as Record<string, unknown>;
  // The monitor API may deliver type/scope as strings, so coerce before lookup.
  const type = Number(attrs.type ?? 1);
  const scope = Number(attrs.scope ?? 1);
  const definedFlows = Array.isArray(attrs.definedFlows)
    ? attrs.definedFlows.map(toDisplayText).filter(Boolean)
    : [];
  const task = asTaskExecution(attrs.task);

  return (
    <FormReadOnlyProvider>
      <div className="space-y-4">
        <ReadOnlyMetadataSection json={json} title="Extension Metadata">
          <ReadOnlyValueField
            label="Extension Type"
            value={EXTENSION_TYPE_LABELS[type] ?? toDisplayText(attrs.type)}
          />
          <ReadOnlyValueField
            label="Extension Scope"
            value={EXTENSION_SCOPE_LABELS[scope] ?? toDisplayText(attrs.scope)}
          />
        </ReadOnlyMetadataSection>

        {FLOW_SCOPED_TYPES.has(type) && (
          <ReadOnlySectionCard
            title="Defined Flows"
            description="Flows this extension applies to."
            contentClassName="flex flex-wrap gap-1.5">
            {definedFlows.length === 0 ? (
              <span className="text-muted-foreground text-sm">No flows defined.</span>
            ) : (
              definedFlows.map((flowName) => (
                <Badge key={flowName} variant="secondary" className="font-mono text-xs">
                  {flowName}
                </Badge>
              ))
            )}
          </ReadOnlySectionCard>
        )}

        <ReadOnlySectionCard
          title="Task"
          description="The task that runs when this extension is invoked."
          contentClassName="space-y-3">
          {/* Both children self-handle the missing case: ComponentRefCard renders
              its own empty state for a keyless ref, ReadOnlyScriptSection renders
              nothing without a script. No `hasTask` gate needed. */}
          <ComponentRefCard
            refValue={task?.task}
            order={task?.order}
            onNavigate={
              onNavigateToComponent
                ? (ref) => onNavigateToComponent(ref.flow ?? 'sys-tasks', ref)
                : undefined
            }
          />
          <ReadOnlyScriptSection label="Mapping" script={task?.mapping ?? null} />
        </ReadOnlySectionCard>
      </div>
    </FormReadOnlyProvider>
  );
}
