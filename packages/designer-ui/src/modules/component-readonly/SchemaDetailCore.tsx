import { useEffect, useMemo, useState } from 'react';

import { FormReadOnlyProvider } from '../../ui/FormReadOnlyContext.js';
import { Skeleton } from '../../ui/Skeleton.js';
import { SchemaTreeEditor } from '../schema-editor/components/tree-editor/SchemaTreeEditor.js';
import { useSchemaSelectionStore } from '../schema-editor/hooks/useSchemaSelection.js';
import { useSchemaEditorStore } from '../schema-editor/useSchemaEditorStore.js';
import { normalizeDefinitionDoc } from './normalizeDefinitionDoc.js';
import { ReadOnlyMetadataSection } from './shared/ReadOnlyMetadataSection.js';
import { ReadOnlySectionCard } from './shared/ReadOnlySectionCard.js';
import { asRecord } from './shared/readonlyGuards.js';

export interface SchemaDetailCoreProps {
  json: Record<string, unknown>;
}

/**
 * Read-only designer view of a schema component document.
 *
 * The JSON Schema payload lives at `attributes.schema` as a plain object (no
 * base64 encoding, unlike script-bearing components), which is exactly the
 * shape the schema editor's store-backed tree reads. So instead of a
 * hand-rolled presentational tree, this mounts the real `SchemaTreeEditor`
 * (property tree + General/Constraints/Composition/vNext detail tabs) under
 * `FormReadOnlyProvider`, seeding `useSchemaEditorStore` from the normalized
 * document. `normalizeDefinitionDoc('schema', …)` lifts a flattened
 * monitor-API `schema` / `type` back into `attributes` first.
 *
 * Store lifecycle: the schema editor store and the selection store are module
 * singletons shared with the forge schema editor, but the two never mount in
 * the same shell (monitoring vs. forge). Seeding happens in an effect (never
 * at render time); the selection is reset to the schema root on every seed
 * because the selection store persists across pages; both stores are cleared
 * on unmount.
 */
export function SchemaDetailCore({ json: raw }: SchemaDetailCoreProps) {
  const json = useMemo(() => normalizeDefinitionDoc('schema', raw), [raw]);
  const attrs = (json.attributes ?? {}) as Record<string, unknown>;
  const schema = asRecord(attrs.schema);
  const hasSchema = schema !== null && Object.keys(schema).length > 0;

  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!hasSchema) {
      return undefined;
    }

    useSchemaEditorStore.getState().setComponent(json, '');
    useSchemaSelectionStore.getState().reset();
    setSeeded(true);

    return () => {
      setSeeded(false);
      useSchemaEditorStore.getState().clear();
      useSchemaSelectionStore.getState().reset();
    };
  }, [json, hasSchema]);

  return (
    <FormReadOnlyProvider>
      <div className="space-y-4">
        <ReadOnlyMetadataSection json={json} title="Schema Metadata" />

        <ReadOnlySectionCard
          title="Structure"
          description="Properties, types and validation of this JSON Schema.">
          {!hasSchema ? (
            <span className="text-muted-foreground text-sm">No schema definition.</span>
          ) : seeded ? (
            <div className="min-h-[420px]">
              <SchemaTreeEditor />
            </div>
          ) : (
            <div className="min-h-[420px] space-y-3" aria-hidden="true">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-80 w-full" />
            </div>
          )}
        </ReadOnlySectionCard>
      </div>
    </FormReadOnlyProvider>
  );
}
