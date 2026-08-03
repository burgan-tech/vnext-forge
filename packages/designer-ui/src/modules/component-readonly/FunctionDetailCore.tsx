import { useMemo } from 'react';

import { Badge } from '../../ui/Badge.js';
import { FormReadOnlyProvider } from '../../ui/FormReadOnlyContext.js';
import { normalizeDefinitionDoc } from './normalizeDefinitionDoc.js';
import { FUNCTION_SCOPE_LABELS } from './readonlyLabels.js';
import { ComponentRefCard, type ComponentRef } from './shared/ComponentRefCard.js';
import { ReadOnlyMetadataSection } from './shared/ReadOnlyMetadataSection.js';
import { ReadOnlyScriptSection } from './shared/ReadOnlyScriptSection.js';
import { ReadOnlySectionCard } from './shared/ReadOnlySectionCard.js';
import { ReadOnlyValueField } from './shared/ReadOnlyValueField.js';
import { asRecord, asScriptLike, asTaskExecution } from './shared/readonlyGuards.js';
import { toDisplayText } from './shared/readonlyText.js';

// Task execution entries are normalized by `asTaskExecution`, which accepts
// both the editor-authored `{order, task, mapping}` nesting AND the canonical
// template shape where `attributes.task` is the reference itself.

/**
 * Human labels for `attributes.cache` keys, mirrored from
 * `function-editor/components/FunctionCacheSection` so the read-only view does
 * not surface raw camelCase field names. Unknown keys fall back to the raw key
 * so a newer runtime field still renders instead of disappearing.
 */
const CACHE_FIELD_LABELS: Record<string, string> = {
  key: 'Key',
  storeName: 'Store Name',
  keyExpression: 'Key Expression',
  ttlInSeconds: 'TTL (seconds)',
  consistency: 'Consistency',
  varyByHeaders: 'Vary By Headers',
  varyByHeaderPrefixes: 'Vary By Header Prefixes',
  generationKey: 'Generation Key',
  generationKeyExpression: 'Generation Key Expression',
  bypassOnCacheError: 'Bypass On Cache Error',
};

export interface FunctionDetailCoreProps {
  json: Record<string, unknown>;
  /** Invoked when the user clicks a referenced task (flow, ref). */
  onNavigateToComponent?: (flow: string, ref: ComponentRef) => void;
}

/** Read-only designer view of a function component document. */
export function FunctionDetailCore({ json: raw, onNavigateToComponent }: FunctionDetailCoreProps) {
  const json = useMemo(() => normalizeDefinitionDoc('function', raw), [raw]);
  const attrs = (json.attributes ?? {}) as Record<string, unknown>;
  const scope = typeof attrs.scope === 'string' ? attrs.scope : 'I';
  const single = asTaskExecution(attrs.task);
  // An empty onExecutionTasks array must NOT shadow a present single task —
  // some documents carry both keys with the unused one left empty.
  const multi = Array.isArray(attrs.onExecutionTasks)
    ? attrs.onExecutionTasks.map(asTaskExecution).filter((item) => item !== null)
    : null;
  const hasMulti = multi !== null && multi.length > 0;
  const output = asScriptLike(attrs.output);
  const rawResponse = attrs.rawResponse === true;
  const cache = asRecord(attrs.cache);

  const navigate = onNavigateToComponent
    ? (ref: ComponentRef) => onNavigateToComponent(ref.flow ?? 'sys-tasks', ref)
    : undefined;

  // Single-task mode is normalized into a one-item list so both modes render
  // through the same ref + mapping pair.
  const executions = hasMulti ? multi : single ? [single] : [];
  let modeBadge = 'None';
  if (hasMulti) modeBadge = `${multi.length} tasks`;
  else if (single) modeBadge = 'Single task';

  return (
    <FormReadOnlyProvider>
      <div className="space-y-4">
        <ReadOnlyMetadataSection json={json} title="Function Metadata">
          <ReadOnlyValueField label="Scope" value={FUNCTION_SCOPE_LABELS[scope] ?? scope} />
        </ReadOnlyMetadataSection>

        <ReadOnlySectionCard
          title="Task Execution"
          description="Tasks executed when this function is called."
          badge={
            <>
              <Badge variant="secondary" className="text-xs">
                {modeBadge}
              </Badge>
              {rawResponse && (
                <Badge variant="outline" className="text-xs">
                  Raw response
                </Badge>
              )}
            </>
          }
          contentClassName="space-y-4">
          {executions.length === 0 ? (
            <span className="text-muted-foreground text-sm">No task executions configured.</span>
          ) : (
            executions.map((item, index) => (
              // Execution entries have no stable id; `order` is optional and
              // may repeat across malformed documents, so the index is used.
              <div key={index} className="space-y-2">
                <ComponentRefCard
                  refValue={item.task}
                  order={item.order ?? index + 1}
                  onNavigate={navigate}
                />
                {/* ReadOnlyScriptSection renders nothing without a script, so
                    no per-item mapping gate is needed here. */}
                <ReadOnlyScriptSection label="Mapping" script={item.mapping ?? null} />
              </div>
            ))
          )}
        </ReadOnlySectionCard>

        {output && (
          <ReadOnlySectionCard
            title="Output Mapping"
            description="Mapping applied after all tasks complete.">
            <ReadOnlyScriptSection label="Output" script={output} />
          </ReadOnlySectionCard>
        )}

        {cache && (
          <ReadOnlySectionCard
            title="Cache"
            description="Read-through cache configuration for this function."
            contentClassName="grid grid-cols-2 gap-3">
            {Object.entries(cache).map(([cacheKey, cacheValue]) => (
              <ReadOnlyValueField
                key={cacheKey}
                label={CACHE_FIELD_LABELS[cacheKey] ?? cacheKey}
                value={
                  Array.isArray(cacheValue) ? cacheValue.join(', ') : toDisplayText(cacheValue)
                }
              />
            ))}
          </ReadOnlySectionCard>
        )}
      </div>
    </FormReadOnlyProvider>
  );
}
