/**
 * Lightweight tenant CSS validator — token-only filter.
 *
 * Spec reference: forgepseudouithemingspec.md §5.5. The Forge contract
 * with tenant authors is: *only CSS custom-property declarations* are
 * accepted ("--p-*" and "--font-family"). Class selectors like
 * `.d-card` cannot be overridden because the SDK's internal class
 * names are not part of the public contract.
 *
 * Two input shapes:
 *   1. `Record<string, string>` (token JSON) — preferred.
 *   2. CSS string — regex-parsed; only `:host { --foo: bar; ... }`
 *      blocks are inspected and only `--*` declarations that pass
 *      `ALLOWED_TOKEN` survive. Everything else is silently dropped.
 *
 * Returns a single rendered `:host { ... }` declaration block ready
 * to be wrapped in `CSSStyleSheet.replaceSync(...)`. Returns an empty
 * string if no valid declarations remain.
 *
 * The regex parser is intentionally minimal — we do not need a full
 * CSS AST because the contract is so narrow. Selectors other than
 * `:host` (and `:root` which we treat as an alias of `:host` per the
 * shadow-DOM cascade convention used throughout this module) are
 * skipped. Nested rules, at-rules, calc() chains, comments — all
 * survive because we only ever read property *names* and *values*
 * via a straightforward declaration-by-declaration scan.
 *
 * Security: CSS injection via `;@import "evil.css"` is blocked by
 * `sanitizeValue` (rejects `;` `{` `}` inside the value text).
 * Property names are constrained to the `--p-*` / `--font-family`
 * regex, so attackers cannot register `background-image: url(...)`
 * to exfiltrate via DNS.
 */

const ALLOWED_TOKEN = /^--p-[a-z0-9-]+$|^--font-family$/i;

function sanitizeValue(v: string): string {
  // CSS injection guard — these characters allow breaking out of the
  // declaration block. Property values that contain them are dropped.
  return /[;{}]/.test(v) ? '' : v.trim();
}

function renderDeclarations(decls: ReadonlyArray<readonly [string, string]>): string {
  const valid: string[] = [];
  for (const [k, rawValue] of decls) {
    if (!ALLOWED_TOKEN.test(k)) continue;
    const v = sanitizeValue(rawValue);
    if (!v) continue;
    valid.push(`  ${k}: ${v};`);
  }
  return valid.join('\n');
}

/**
 * Build a `:host { ... }` declaration block from a token map.
 * Returns empty string if no valid tokens.
 */
export function tokensToHostBlock(tokens: Record<string, string>): string {
  const entries = Object.entries(tokens);
  const decls = renderDeclarations(entries);
  return decls ? `:host {\n${decls}\n}` : '';
}

/**
 * Extract `:host { --*: ... }` declarations from a raw CSS string.
 *
 * Implementation: scan top-level `<selector> { ... }` blocks via a
 * brace-balanced regex. For each block whose selector contains
 * `:host` (or `:root`), pull `name: value;` declarations and filter
 * through `ALLOWED_TOKEN`.
 */
export function extractAllowedDeclarations(cssText: string): string {
  // Strip block comments so they don't confuse the brace scanner.
  const stripped = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  const blockRe = /([^{}]+)\{([^{}]*)\}/g;
  const decls: Array<[string, string]> = [];

  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(stripped)) !== null) {
    const selector = match[1].trim();
    if (!/(^|[^a-zA-Z-]):(host|root)\b/.test(selector) && selector !== ':host' && selector !== ':root') {
      continue;
    }
    const body = match[2];
    const declRe = /(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);?/g;
    let dm: RegExpExecArray | null;
    while ((dm = declRe.exec(body)) !== null) {
      decls.push([dm[1].trim(), dm[2].trim()]);
    }
  }

  const rendered = renderDeclarations(decls);
  return rendered ? `:host {\n${rendered}\n}` : '';
}

/**
 * Public entry — accepts either a token map or a CSS string and
 * returns a `:host { ... }` block (or `''` if nothing valid).
 */
export function buildTenantOverrideBlock(input: Record<string, string> | string | null | undefined): string {
  if (!input) return '';
  if (typeof input === 'string') return extractAllowedDeclarations(input);
  return tokensToHostBlock(input);
}
