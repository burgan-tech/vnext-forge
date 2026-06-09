/**
 * Unified parser for vNext resource URNs.
 *
 * Canonical form:
 *
 *   urn:vnext:res:<res-key>:<domain>:<key>[:<version>]
 *
 * Examples:
 *
 *   urn:vnext:res:schema:core:input-schema
 *   urn:vnext:res:view:onboarding:account-summary:1.0.0
 *   urn:vnext:res:function:retail:get-customer-tier
 *
 * `<res-key>` is one of the six vNext component categories. Each maps
 * to a runtime workflow flow (the engine endpoint that returns the
 * resource's payload):
 *
 *   schema    → sys-schemas
 *   flow      → sys-flows
 *   extension → sys-extensions
 *   function  → sys-functions
 *   view      → sys-views
 *   task      → sys-tasks
 *
 * Hard cut: the legacy `urn:amorphie:res:*` family is **not**
 * recognised. Empty / non-URN / unknown-`res-key` inputs return
 * `null` so callers can surface a clear "missing or unsupported
 * resource ref" diagnostic.
 */

export const RES_KEYS = ['schema', 'flow', 'extension', 'function', 'view', 'task'] as const;

export type ResKey = (typeof RES_KEYS)[number];

/**
 * Map each `res-key` to the workflow flow whose runtime endpoint
 * returns instances of that resource. Exported so resolvers in other
 * modules can swap their hard-coded `'sys-schemas'` for a
 * res-key-driven lookup without re-encoding the table.
 */
export const RES_KEY_TO_FLOW: Record<ResKey, string> = {
  schema: 'sys-schemas',
  flow: 'sys-flows',
  extension: 'sys-extensions',
  function: 'sys-functions',
  view: 'sys-views',
  task: 'sys-tasks',
};

export interface VnextResRef {
  resKey: ResKey;
  domain: string;
  key: string;
  /** Optional version segment carried verbatim; the engine uses it as
   *  `latest` when omitted. */
  version?: string;
}

const PREFIX = 'urn:vnext:res:';

function isResKey(value: string): value is ResKey {
  return (RES_KEYS as readonly string[]).includes(value);
}

export function parseVnextResUrn(input: string | null | undefined): VnextResRef | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith(PREFIX)) return null;

  const rest = trimmed.slice(PREFIX.length);
  const parts = rest.split(':').map((p) => p.trim());
  // Accept 3 segments (res-key:domain:key) or 4 (… : version).
  if (parts.length !== 3 && parts.length !== 4) return null;

  const [rawResKey, domain, key, version] = parts;
  if (!rawResKey || !domain || !key) return null;
  if (!isResKey(rawResKey)) return null;
  if (parts.length === 4 && !version) return null;

  return version
    ? { resKey: rawResKey, domain, key, version }
    : { resKey: rawResKey, domain, key };
}
