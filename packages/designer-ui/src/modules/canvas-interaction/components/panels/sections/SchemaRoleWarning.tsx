import { AlertTriangle } from 'lucide-react';

import type { SchemaRole } from '@vnext-forge-studio/vnext-types';

import { useProjectStore } from '../../../../../store/useProjectStore';
import { readSchemaAttributesType } from '../../../../schema-editor/SchemaEditorSchema';
import { schemaRoleSlotMismatch, schemaRolesEnforced } from '../../../../schema-editor/model/schemaRoles';
import { readSchemaReference } from '../../../../vnext-workspace/loadSchemaComponent';
import { useSchemaComponentJson } from '../../../../vnext-workspace/useSchemaComponentJson';

export interface SchemaRoleWarningProps {
  /** Raw schema reference from the workflow / transition JSON. */
  schemaRef: unknown;
  /** Role the slot needs (vnext-schema 0.0.56 schema roles). */
  expectedRole: SchemaRole;
}

/**
 * Warns when the referenced schema's `attributes.type` does not fit the slot
 * (e.g. a master schema reused as a transition body). Silent for projects
 * pinned below 0.0.56, for untyped schemas and while the schema loads.
 */
export function SchemaRoleWarning({ schemaRef, expectedRole }: SchemaRoleWarningProps) {
  const schemaVersion = useProjectStore((s) => s.vnextConfig?.schemaVersion);
  const ref = readSchemaReference(schemaRef);
  const schemaJson = useSchemaComponentJson(ref);
  if (!ref?.key || !schemaJson || !schemaRolesEnforced(schemaVersion)) return null;
  const message = schemaRoleSlotMismatch(readSchemaAttributesType(schemaJson), expectedRole);
  if (!message) return null;

  return (
    <div
      role="alert"
      className="border-warning-border bg-warning text-warning-foreground flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] leading-relaxed">
      <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />
      <span>
        Schema <span className="font-mono">{ref.key}</span>: {message}
      </span>
    </div>
  );
}
