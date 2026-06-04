/**
 * Discriminated parser for the action `command` URNs Forge accepts.
 *
 * The vNext URN family (current generation) covers four authoring
 * primitives that views can use as `Button.command` / `Card.onClick`
 * values:
 *
 *   urn:vnext:flow:start:<domain>:<flow>
 *     → Start a brand-new workflow instance. No instance id involved.
 *
 *   urn:vnext:flow:transition:<domain>:<flow>:<instance>:<transition>
 *     → Fire a transition on a specific instance. Used when the view
 *       authors the target instance explicitly (often via a
 *       `${param}` binding resolved upstream).
 *
 *   urn:vnext:flow:transition:<domain>:<flow>:<transition>
 *     → Fire a transition on the **current** Quick Run instance. The
 *       runtime / dispatcher substitutes the live instance id at
 *       call time.
 *
 *   urn:vnext:fn[:<command>]:<domain>[:<flow>:<instance>]:<function>
 *     → Invoke an engine function. `command ∈ {get, post, patch,
 *       delete}` (default `get`). Flow + instance segments are
 *       jointly optional — present together for instance-scoped
 *       endpoints, omitted for the stateless domain-level endpoint.
 *
 * Non-URN inputs (raw transition key, slug, short-code) flow through
 * as `kind: 'raw'`. Empty / non-string returns `null` so callers can
 * surface a clear "missing command" error.
 *
 * Anything that begins with `urn:` but doesn't match the families
 * above (including the legacy `urn:amorphie:*` prefix — vNext is a
 * hard cut) returns `kind: 'unknown'` so the host can still log the
 * raw value and skip dispatch instead of crashing.
 *
 * NOTE: `${param}` placeholders inside the URN must be resolved
 * before this parser runs. See `resolveUrnBindings.ts`.
 */

export type FnCommand = 'get' | 'post' | 'patch' | 'delete';

export type ParsedVnextUrn =
  | { kind: 'flow-start'; domain: string; flow: string; raw: string }
  | {
      kind: 'flow-transition';
      domain: string;
      flow: string;
      /** Undefined → fire on the current Quick Run instance. */
      instance: string | undefined;
      transition: string;
      raw: string;
    }
  | {
      kind: 'fn';
      command: FnCommand;
      domain: string;
      /** Present together with `instance` for workflow-scoped calls. */
      flow?: string;
      instance?: string;
      function: string;
      raw: string;
    }
  | { kind: 'raw'; value: string }
  | { kind: 'unknown'; raw: string };

// ── Pattern constants (single source so the catalog service can reuse) ──

export const VNEXT_FLOW_PREFIX = 'urn:vnext:flow:';
export const VNEXT_FN_PREFIX = 'urn:vnext:fn:';

export const FN_COMMANDS: readonly FnCommand[] = ['get', 'post', 'patch', 'delete'] as const;

function isFnCommand(value: string): value is FnCommand {
  return (FN_COMMANDS as readonly string[]).includes(value);
}

export function parseVnextUrn(value: string | undefined | null): ParsedVnextUrn | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // ── urn:vnext:flow:* — flow-start | flow-transition ──
  if (trimmed.startsWith(VNEXT_FLOW_PREFIX)) {
    const tail = trimmed.slice(VNEXT_FLOW_PREFIX.length);
    const segments = tail.split(':').map((p) => p.trim());

    // start:<domain>:<flow>  (3 segments incl. literal)
    if (segments[0] === 'start') {
      if (segments.length === 3) {
        const [, domain, flow] = segments;
        if (domain && flow) {
          return { kind: 'flow-start', domain, flow, raw: trimmed };
        }
      }
      return { kind: 'unknown', raw: trimmed };
    }

    // transition:<domain>:<flow>:<instance>:<transition>  (5 segments)
    // transition:<domain>:<flow>:<transition>             (4 segments — current instance)
    if (segments[0] === 'transition') {
      if (segments.length === 5) {
        const [, domain, flow, instance, transition] = segments;
        if (domain && flow && instance && transition) {
          return {
            kind: 'flow-transition',
            domain,
            flow,
            instance,
            transition,
            raw: trimmed,
          };
        }
      } else if (segments.length === 4) {
        const [, domain, flow, transition] = segments;
        if (domain && flow && transition) {
          return {
            kind: 'flow-transition',
            domain,
            flow,
            instance: undefined,
            transition,
            raw: trimmed,
          };
        }
      }
      return { kind: 'unknown', raw: trimmed };
    }

    return { kind: 'unknown', raw: trimmed };
  }

  // ── urn:vnext:fn:* — domain or workflow-scoped function ──
  if (trimmed.startsWith(VNEXT_FN_PREFIX)) {
    const tail = trimmed.slice(VNEXT_FN_PREFIX.length);
    const parts = tail.split(':').map((p) => p.trim());
    if (parts.length === 0) return { kind: 'unknown', raw: trimmed };

    // First segment optionally carries the HTTP verb (default `get`).
    let command: FnCommand = 'get';
    let rest = parts;
    if (isFnCommand(parts[0])) {
      command = parts[0];
      rest = parts.slice(1);
    }

    if (rest.length === 2) {
      const [domain, fn] = rest;
      if (domain && fn) {
        return { kind: 'fn', command, domain, function: fn, raw: trimmed };
      }
    } else if (rest.length === 4) {
      const [domain, flow, instance, fn] = rest;
      if (domain && flow && instance && fn) {
        return {
          kind: 'fn',
          command,
          domain,
          flow,
          instance,
          function: fn,
          raw: trimmed,
        };
      }
    }
    return { kind: 'unknown', raw: trimmed };
  }

  // Any other URN — record but don't claim semantic. Legacy
  // `urn:amorphie:*`, `urn:forge:nav:*`, `urn:tenant:*` etc. land
  // here in the vNext era.
  if (trimmed.startsWith('urn:')) {
    return { kind: 'unknown', raw: trimmed };
  }

  // ── Raw key / slug / short-code. ──
  return { kind: 'raw', value: trimmed };
}
