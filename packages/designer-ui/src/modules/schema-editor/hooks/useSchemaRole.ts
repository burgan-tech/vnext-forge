import type { SchemaRole } from '@vnext-forge-studio/vnext-types';

import { useProjectStore } from '../../../store/useProjectStore';
import { classifySchemaType, schemaRolesEnforced } from '../model/schemaRoles';
import { readSchemaAttributesType } from '../SchemaEditorSchema';
import { useSchemaEditorStore } from '../useSchemaEditorStore';

/**
 * The open schema's role when the project's vnext-schema enforces roles
 * (≥ 0.0.56); `undefined` for untyped or legacy-typed schemas and older pins.
 */
export function useSchemaRole(): SchemaRole | undefined {
  const componentJson = useSchemaEditorStore((s) => s.componentJson);
  const schemaVersion = useProjectStore((s) => s.vnextConfig?.schemaVersion);
  if (!schemaRolesEnforced(schemaVersion)) return undefined;
  const type = classifySchemaType(readSchemaAttributesType(componentJson));
  return type.kind === 'role' ? type.role : undefined;
}
