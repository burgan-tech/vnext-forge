/**
 * Discriminated parser for the action `command` URNs Forge accepts.
 *
 * Canonical shapes (from `view-vocabulary.md` and
 * `forgeactionmodelintegration.md §4.3`):
 *
 *   urn:amorphie:wf:<flow>:transition:<state>     → workflow transition
 *   urn:amorphie:func:<domain>:<function>         → BFF function call
 *   urn:forge:nav:<route>                         → navigation (Quick
 *                                                   Runner doesn't have a
 *                                                   router; parsed but not
 *                                                   dispatched)
 *   urn:tenant:<tenant>:<path>                    → tenant custom (no-op
 *                                                   in core Forge)
 *
 * Legacy R24 shape kept for back-compat — Amorphie views shipped before
 * the v0.2 vocabulary use:
 *
 *   urn:amorphie:transition:<dom>:<wf>:<inst>:<name>  → legacy-transition
 *
 * Non-URN inputs (raw transition key, slug, short-code) flow through as
 * `kind: 'raw'`. Empty / non-string returns `null` so callers can
 * surface a clear "missing command" error.
 *
 * Unknown URN shapes (any `urn:...` we don't recognise) return
 * `kind: 'unknown'` so the host can still see the raw value and log it.
 */

export type ParsedAmorphieUrn =
  | { kind: 'wf-transition'; flow: string; state: string; raw: string }
  | { kind: 'func'; domain: string; function: string; raw: string }
  | { kind: 'nav'; route: string; raw: string }
  | { kind: 'tenant'; tenant: string; path: string; raw: string }
  | { kind: 'legacy-transition'; domain: string; workflow: string; instance: string; state: string; raw: string }
  | { kind: 'raw'; value: string }
  | { kind: 'unknown'; raw: string };

// ── Pattern constants (single source so the catalog service can reuse) ──

export const WF_TRANSITION_PREFIX = 'urn:amorphie:wf:';
export const FUNC_PREFIX = 'urn:amorphie:func:';
export const LEGACY_TRANSITION_PREFIX = 'urn:amorphie:transition:';
export const NAV_PREFIX = 'urn:forge:nav:';
export const TENANT_PREFIX = 'urn:tenant:';

export function parseAmorphieUrn(value: string | undefined | null): ParsedAmorphieUrn | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // ── Canonical Amorphie URN: urn:amorphie:wf:<flow>:transition:<state> ──
  if (trimmed.startsWith(WF_TRANSITION_PREFIX)) {
    // Expect 6 colon-segments total: urn:amorphie:wf:<flow>:transition:<state>
    const segments = trimmed.split(':');
    if (segments.length >= 6 && segments[4] === 'transition') {
      const flow = segments[3]?.trim();
      // State may itself contain colons in pathological cases — re-join the tail.
      const state = segments.slice(5).join(':').trim();
      if (flow && state) {
        return { kind: 'wf-transition', flow, state, raw: trimmed };
      }
    }
    return { kind: 'unknown', raw: trimmed };
  }

  // ── Amorphie function URN: urn:amorphie:func:<domain>:<function> ──
  if (trimmed.startsWith(FUNC_PREFIX)) {
    const tail = trimmed.slice(FUNC_PREFIX.length);
    const parts = tail.split(':');
    if (parts.length >= 2) {
      const domain = parts[0]?.trim();
      // Function key may contain colons (rare, but defend against it).
      const fn = parts.slice(1).join(':').trim();
      if (domain && fn) {
        return { kind: 'func', domain, function: fn, raw: trimmed };
      }
    }
    return { kind: 'unknown', raw: trimmed };
  }

  // ── Legacy Amorphie transition URN (R24): ──
  // urn:amorphie:transition:<dom>:<wf>:<inst>:<name>  (7 segments)
  // urn:amorphie:transition:<dom>:<wf>:<name>          (6 segments — legacy without instance)
  if (trimmed.startsWith(LEGACY_TRANSITION_PREFIX)) {
    const segments = trimmed.split(':');
    if (segments.length >= 7) {
      const [, , , domain, workflow, instance, ...rest] = segments;
      const state = rest.join(':').trim();
      if (domain && workflow && instance && state) {
        return {
          kind: 'legacy-transition',
          domain,
          workflow,
          instance,
          state,
          raw: trimmed,
        };
      }
    }
    if (segments.length === 6) {
      const [, , , domain, workflow, state] = segments;
      if (domain && workflow && state) {
        return {
          kind: 'legacy-transition',
          domain,
          workflow,
          instance: '',
          state,
          raw: trimmed,
        };
      }
    }
    return { kind: 'unknown', raw: trimmed };
  }

  // ── Forge navigation URN: urn:forge:nav:<route> ──
  if (trimmed.startsWith(NAV_PREFIX)) {
    const route = trimmed.slice(NAV_PREFIX.length).trim();
    if (route) return { kind: 'nav', route, raw: trimmed };
    return { kind: 'unknown', raw: trimmed };
  }

  // ── Tenant URN: urn:tenant:<tenant>:<path> ──
  if (trimmed.startsWith(TENANT_PREFIX)) {
    const tail = trimmed.slice(TENANT_PREFIX.length);
    const idx = tail.indexOf(':');
    if (idx > 0) {
      const tenant = tail.slice(0, idx).trim();
      const path = tail.slice(idx + 1).trim();
      if (tenant && path) {
        return { kind: 'tenant', tenant, path, raw: trimmed };
      }
    }
    return { kind: 'unknown', raw: trimmed };
  }

  // ── Other URN — record but don't claim semantic. ──
  if (trimmed.startsWith('urn:')) {
    return { kind: 'unknown', raw: trimmed };
  }

  // ── Raw key / slug / short-code. ──
  return { kind: 'raw', value: trimmed };
}
