/**
 * `${param}` binding resolver for vNext URNs.
 *
 * Authors embed placeholders in `Button.command` URNs (and other
 * action strings) — e.g.
 *
 *   urn:vnext:flow:transition:onboarding:kyc-main-flow:${instanceId}:approved
 *   urn:vnext:fn:get:onboarding:custom-function?customerId=${customer.id}
 *
 * The dispatcher runs this resolver **before** handing the string to
 * `parseVnextUrn`. The parser stays pure (literal strings only); this
 * module owns all runtime context substitution.
 *
 * Context sources, queried in order:
 *
 *   1. `data` — Quick Run's `activeData.data` (the same payload the
 *      Data tab renders).
 *   2. `extensions` — `activeData.extensions` (also surfaced in the
 *      Data tab as a second JSON section).
 *   3. `formData` — Optional pseudo-ui form scratchpad for the
 *      transition currently being authored.
 *
 * Path syntax is dotted (`a.b.c`). Whole paths are tried verbatim
 * first; if a path doesn't hit in `data`, the resolver also tries it
 * under `extensions` (and `formData`). This keeps view authors free
 * to write either `${customer.id}` or `${data.customer.id}` and
 * both work.
 *
 * Unresolved placeholders are NOT silently swallowed — they are
 * returned to the caller so the dispatcher can decide whether to
 * surface a banner + log + abort or fall through. Non-string values
 * are JSON-stringified inline so they remain URL-safe.
 */

export interface UrnBindingContext {
  data: Record<string, unknown> | null | undefined;
  extensions: Record<string, unknown> | null | undefined;
  formData?: Record<string, unknown>;
}

export interface UrnBindingResolution {
  /** Original string with every resolvable `${...}` replaced. */
  resolved: string;
  /** Placeholders that had no matching path in any context source. */
  unresolved: string[];
}

const PLACEHOLDER_RE = /\$\{([^}]+)\}/g;

/**
 * Walk a dotted path through a plain object. Returns `undefined` when
 * any segment is missing or when traversal hits a non-object. Array
 * index access is intentionally NOT supported — URN authors who need
 * to pluck an element should resolve the index upstream.
 */
function readPath(source: unknown, path: string): unknown {
  if (!source || typeof source !== 'object') return undefined;
  const segments = path.split('.').map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return undefined;
  let cursor: unknown = source;
  for (const segment of segments) {
    if (cursor == null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

/**
 * Render a resolved value back into the URN string. Strings and
 * numbers pass through; booleans become their literal `true`/`false`;
 * arrays and objects are JSON-stringified to stay URL-safe; null and
 * undefined become the empty string (the caller treats `undefined` as
 * "unresolved" upstream, so this branch only fires for explicit
 * nulls).
 */
function renderValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function resolveUrnBindings(
  rawUrn: string,
  ctx: UrnBindingContext,
): UrnBindingResolution {
  if (typeof rawUrn !== 'string' || !rawUrn) {
    return { resolved: rawUrn ?? '', unresolved: [] };
  }

  const unresolved: string[] = [];
  const resolved = rawUrn.replace(PLACEHOLDER_RE, (_match, rawPath) => {
    const path = String(rawPath).trim();
    if (!path) {
      unresolved.push('');
      return '${}';
    }

    // The resolver tries every context source. `undefined` means
    // "missing key"; an explicit `null` counts as resolved-empty so
    // intentional nulls don't surface as authoring errors.
    const sources: unknown[] = [];
    if (ctx.data) sources.push(ctx.data);
    if (ctx.extensions) sources.push(ctx.extensions);
    if (ctx.formData) sources.push(ctx.formData);

    for (const source of sources) {
      const hit = readPath(source, path);
      if (hit !== undefined) {
        return renderValue(hit);
      }
    }

    unresolved.push(path);
    // Keep the original placeholder intact so the caller can show it
    // in an error banner / log line.
    return `\${${path}}`;
  });

  return { resolved, unresolved };
}
