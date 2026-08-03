import { useMemo } from 'react';

import { FormReadOnlyProvider } from '../../ui/FormReadOnlyContext.js';
import { normalizeDefinitionDoc } from './normalizeDefinitionDoc.js';
import { ReadOnlyMetadataSection } from './shared/ReadOnlyMetadataSection.js';
import {
  ReadOnlyScriptSection,
  type ReadOnlyScriptSectionProps,
} from './shared/ReadOnlyScriptSection.js';
import { ReadOnlySectionCard } from './shared/ReadOnlySectionCard.js';
import { ReadOnlyValueField } from './shared/ReadOnlyValueField.js';

export interface MappingDetailCoreProps {
  json: Record<string, unknown>;
}

/**
 * Read-only designer view of a `sys-mappings` component document.
 *
 * Unlike tasks / extensions / functions, a mapping's script fields live
 * directly on `attributes` (`name`, `location`, `code`, `encoding`) rather than
 * inside a nested mapping object, so the script section is fed a synthesized
 * `ScriptLike`. `normalizeDefinitionDoc('mapping', …)` also aliases a flattened
 * `script` field onto `code` for the monitor API's flattened payload shape.
 */
export function MappingDetailCore({ json: raw }: MappingDetailCoreProps) {
  const json = useMemo(() => normalizeDefinitionDoc('mapping', raw), [raw]);
  const attrs = (json.attributes ?? {}) as Record<string, unknown>;

  // ReadOnlyScriptSection bails out (returns null) when the script has neither
  // `code` nor `location`, which would leave the card body visually empty — so
  // unlike the ComponentRefCard call sites this gate IS required to surface an
  // empty state.
  const script: NonNullable<ReadOnlyScriptSectionProps['script']> = {
    location: typeof attrs.location === 'string' ? attrs.location : undefined,
    code: attrs.code,
    encoding: typeof attrs.encoding === 'string' ? attrs.encoding : undefined,
  };
  const hasBody = script.code !== undefined || Boolean(script.location);

  return (
    <FormReadOnlyProvider>
      <div className="space-y-4">
        <ReadOnlyMetadataSection
          json={json}
          title="Mapping"
          description="Root metadata for this sys-mappings component.">
          <ReadOnlyValueField label="Flow Version" value={json.flowVersion} mono />
          <ReadOnlyValueField label="Name" value={attrs.name} />
        </ReadOnlyMetadataSection>

        <ReadOnlySectionCard
          title="Mapping Body"
          description="The reusable C# helper class other components reference.">
          {hasBody ? (
            <ReadOnlyScriptSection label="Body" script={script} />
          ) : (
            <span className="text-muted-foreground text-sm">No script body.</span>
          )}
        </ReadOnlySectionCard>
      </div>
    </FormReadOnlyProvider>
  );
}
