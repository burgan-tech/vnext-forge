/**
 * Resolve a pseudo-ui `Button.command` value into a workflow
 * transition key.
 *
 * Since R25 this is a thin wrapper over `parseAmorphieUrn` — the
 * shared discriminated parser owns format knowledge so the catalog
 * service, the delegate dispatch table, and this helper all agree
 * on what counts as a transition URN.
 *
 * Supported inputs (delegated to `parseAmorphieUrn`):
 *
 *   1. Canonical Amorphie workflow URN:
 *      `urn:amorphie:wf:<flow>:transition:<state>` → `<state>`
 *   2. Legacy Amorphie transition URN (R24, 5- or 6-segment):
 *      `urn:amorphie:transition:<dom>:<wf>[:<inst>]:<name>` → `<name>`
 *   3. Generic URN — last `:` or `/` segment (preserved for HTTPS
 *      URLs and other authoring conventions we tolerated pre-R25).
 *   4. Raw key — returned as-is.
 *
 * Returns `null` for empty / undefined / unparseable input so the
 * caller can surface a clear "Missing transition command" error.
 */

import { parseAmorphieUrn } from './parseAmorphieUrn';

export function resolveTransitionKey(command: string | undefined | null): string | null {
  const parsed = parseAmorphieUrn(command);
  if (!parsed) return null;

  switch (parsed.kind) {
    case 'wf-transition':
    case 'legacy-transition':
      return parsed.state || null;
    case 'raw': {
      // Tolerate HTTPS URL command form `https://host/transitions/<flow>/<name>`
      // — pre-R25 authoring used these; return the last path segment.
      const v = parsed.value;
      if (/^https?:\/\//i.test(v)) {
        const tail = v.split('/').pop()?.trim();
        return tail && tail.length > 0 ? tail : v;
      }
      return v || null;
    }
    case 'unknown': {
      // Maintain pre-R25 tolerant behaviour for generic URNs / URLs:
      // take the last `:` or `/` segment.
      const tail = parsed.raw.split(/[:/]/).pop()?.trim();
      return tail && tail.length > 0 ? tail : parsed.raw;
    }
    case 'func':
    case 'nav':
    case 'tenant':
      // These URN kinds aren't workflow transitions. Caller will route
      // them elsewhere; returning null here flags "not a transition".
      return null;
  }
}
