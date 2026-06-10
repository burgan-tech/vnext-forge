import type { ScriptsConfig } from './scripts';

/**
 * Reference shape used when a script body is delegated to a
 * `sys-mappings` component instead of inlined. Mirrors
 * `ResourceReference` but pins `flow` to `'sys-mappings'`.
 */
export interface MappingCodeRef {
  key: string;
  version: string;
  flow: 'sys-mappings';
  domain?: string;
}

export type MappingCodeEncoding = 'B64' | 'NAT' | 'REF';

/**
 * Inline / referenced script body used by every mapping / rule /
 * timer slot across the workflow domain.
 *
 *   - encoding 'B64' or 'NAT'  → `code` is a string (base64 or raw)
 *   - encoding 'REF'           → `code` is a `MappingCodeRef` pointing
 *                                at a sys-mappings component
 *
 * `sys-mappings` itself rejects `REF` (no self-reference); that
 * constraint lives in the AJV schema and in the Mapping editor UI.
 */
export interface MappingCode {
  location?: string;
  code?: string | MappingCodeRef;
  encoding?: MappingCodeEncoding;
  scripts?: ScriptsConfig;
}

/**
 * Narrow `MappingCode.code` to its reference form.
 */
export function isMappingCodeRef(code: MappingCode['code']): code is MappingCodeRef {
  return (
    typeof code === 'object' &&
    code !== null &&
    typeof (code as MappingCodeRef).key === 'string' &&
    typeof (code as MappingCodeRef).version === 'string' &&
    (code as MappingCodeRef).flow === 'sys-mappings'
  );
}

/**
 * vNext `sys-mappings` component schema — a named, reusable CSX helper
 * (e.g. `JsonHelper`) referenced by other mappings via `encoding: REF`.
 * The on-disk attributes are intentionally a subset of `MappingCode`:
 * `encoding` is constrained to `B64 | NAT` (no self-reference) and
 * `scripts` is not yet supported on the mapping itself.
 */
export interface MappingDefinitionAttributes {
  name: string;
  location?: string;
  code: string;
  encoding: 'B64' | 'NAT';
}

export interface VnextMapping {
  $schema?: string;
  _comment?: string;
  key: string;
  version: string;
  domain: string;
  flow: 'sys-mappings';
  flowVersion: string;
  tags: string[];
  attributes: MappingDefinitionAttributes;
}
