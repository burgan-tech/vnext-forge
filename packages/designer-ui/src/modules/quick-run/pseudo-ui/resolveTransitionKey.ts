/**
 * Resolve a pseudo-ui `Button.command` value into a workflow
 * transition key.
 *
 * Since the vNext URN migration the parser owns format knowledge —
 * the catalog service, the delegate dispatch table, and this helper
 * all agree on what counts as a transition URN. The parser is run on
 * a string that has already had any `${param}` placeholders
 * substituted (see `resolveUrnBindings.ts`).
 *
 * Supported inputs (delegated to `parseVnextUrn`):
 *
 *   1. vNext transition URN (either form):
 *      urn:vnext:flow:transition:<domain>:<flow>:<instance>:<state>
 *      urn:vnext:flow:transition:<domain>:<flow>:<state>
 *      → returns `<state>`.
 *   2. Generic URN (`urn:something:else`) — last `:`/`/` segment as
 *      a tolerant fallback for unknown shapes.
 *   3. Raw key — returned as-is, with an HTTPS-URL last-segment
 *      escape hatch for pre-R25 authoring conventions.
 *
 * Returns `null` for empty / undefined / unparseable input so the
 * caller can surface a clear "Missing transition command" error.
 */

import { parseVnextUrn } from './parseVnextUrn';

export function resolveTransitionKey(command: string | undefined | null): string | null {
  const parsed = parseVnextUrn(command);
  if (!parsed) return null;

  switch (parsed.kind) {
    case 'flow-transition':
      return parsed.transition || null;
    case 'raw': {
      // Tolerate HTTPS URL command form `https://host/transitions/<flow>/<name>`
      // — pre-R25 authoring used these; return the last path segment.
      const v = parsed.value;
      if (typeof v !== 'string' || !v) return null;
      if (/^https?:\/\//i.test(v)) {
        const tail = v.split('/').pop()?.trim();
        return tail && tail.length > 0 ? tail : v;
      }
      return v || null;
    }
    case 'unknown': {
      // Tolerant fallback for any URN we don't recognise (legacy
      // `urn:amorphie:*` lands here in the vNext era). Take the last
      // `:` or `/` segment so existing buttons still surface
      // *something*; the dispatcher decides whether to actually fire.
      const raw = parsed.raw;
      if (typeof raw !== 'string' || !raw) return null;
      const tail = raw.split(/[:/]/).pop()?.trim();
      return tail && tail.length > 0 ? tail : raw;
    }
    case 'flow-start':
    case 'fn':
      // These URN kinds aren't workflow transitions. Caller will
      // route them elsewhere; returning null here flags "not a
      // transition".
      return null;
  }
}
