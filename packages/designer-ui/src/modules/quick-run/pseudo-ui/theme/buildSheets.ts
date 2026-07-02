/**
 * R10 theme stack builder — composes 4 cascading layers into the
 * shadow root's `adoptedStyleSheets`.
 *
 * Spec reference: forgepseudouithemingspec.md §4 (cascade order) +
 * §5.2 (atomic swap) + §5.3 (base theme loader) + §5.4 (Forge
 * override builder).
 *
 * Layers (each subsequent layer wins cascade):
 *   L1 — Base PrimeReact MDC theme (`mdc-light-indigo` /
 *        `mdc-dark-indigo`). `?raw` import, `:root` rewritten to
 *        `:host, :root` so the design-token declarations bind inside
 *        the shadow tree (per CSS scoping spec, raw `:root` matches
 *        nothing in shadow scope).
 *   L2 — Forge default token overrides (`forgeDefaults.ts`) wrapped
 *        in `:host { ... }`.
 *   L3 — Tenant override (optional). Already-sanitised `:host { ... }`
 *        block from `parseTenantCss.ts`.
 *   L4 — SDK component CSS (`pseudo-ui-react.css`). Adopted by the
 *        SDK itself when `<PseudoView renderRoot={shadow}>` is used.
 *        Not handled here — see PseudoUiPseudoViewFrame.tsx.
 *
 * Plus a non-cascading utility sheet for `.p-hidden-accessible` and
 * the Stepper full-circle override (PrimeReact 10.9 ships no static
 * file for these — see comments in PseudoUiPseudoViewFrame for the
 * history).
 *
 * Sheet caching: every distinct theme key produces exactly one
 * `CSSStyleSheet` instance (constructable). Subsequent calls reuse
 * the cached instance. Tenant sheet caches by content hash. Theme
 * swap is then a single assignment to `shadow.adoptedStyleSheets`,
 * which the browser applies atomically — no inter-frame flicker.
 *
 * Browser support: Constructable Stylesheets are required (Chrome
 * 73+, Safari 16.4+, Firefox 101+). VS Code's webview is Chromium,
 * the web shell targets the same baseline. The SDK's
 * `adoptStylesIntoRoot` falls back to `<style>` tags if not
 * available; for our atomic-swap pattern we rely on the construct-
 * able path being present (consistent with the rest of R7+).
 */

import primeMdcLightCss from 'primereact/resources/themes/mdc-light-indigo/theme.css?raw';
import primeMdcDarkCss from 'primereact/resources/themes/mdc-dark-indigo/theme.css?raw';
import designerChromeCss from './designerChrome.css?raw';

import { customizeMdcTheme, hashReplacements } from './customizeMdcTheme';
import { FORGE_DEFAULT_TOKENS, type AppTheme } from './forgeDefaults';
import { buildTenantOverrideBlock } from './parseTenantCss';

/**
 * PrimeReact's static themes declare `:root { --p-...: ... }`. In a
 * shadow tree `:root` matches nothing. We expand the selector list
 * so the declarations bind to both light DOM roots and shadow hosts.
 */
function shadowSafeThemeCss(raw: string): string {
  return raw.replace(/:root\s*{/g, ':host, :root {');
}

/**
 * Utility classes PrimeReact 10 components depend on but no static
 * file ships in v10.9+:
 *   - `.p-hidden-accessible` hides Dropdown / Calendar / MultiSelect
 *     native `<select>` / `<input>` peers visually.
 *   - `.p-stepper-number` Lara/MDC ship 4-px rounded squares; the
 *     Forge convention is full circle.
 */
const PRIMEREACT_BASE_UTILITIES_CSS = `
.p-hidden-accessible {
  border: 0;
  clip: rect(0 0 0 0);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  width: 1px;
}
.p-hidden-accessible input,
.p-hidden-accessible select {
  transform: scale(0);
}

/* Stepper number indicators — full circle (Lara/MDC default is rounded square). */
.p-stepper-number {
  border-radius: 50%;
}
`;

// ──────────────────────────────────────────────────────────────────
// Sheet caches — module-level so all PseudoViewHost instances share
// the same constructed `CSSStyleSheet` instances (memory + parse
// cost paid once per theme variant).
// ──────────────────────────────────────────────────────────────────

// Cache keys: plain theme name for un-customized base; `${theme}|${hash}`
// when brand replacements are applied.
const baseSheetCache = new Map<string, CSSStyleSheet>();
const forgeOverrideCache = new Map<AppTheme, CSSStyleSheet>();
const tenantSheetCache = new Map<string, CSSStyleSheet>();
let utilitiesSheet: CSSStyleSheet | null = null;
let designerChromeSheet: CSSStyleSheet | null = null;

/**
 * Build the Layer 1 (PrimeReact MDC theme) sheet.
 *
 * `replacements`: when a brand JSON is active, this is the
 * "MDC hex → brand hex" map produced by `derivePrimeReactReplacements()`.
 * Every hex in the raw MDC CSS is rewritten to its brand equivalent
 * before adoption — PrimeReact's hardcoded indigo (`#3F51B5`) becomes
 * the brand primary, the Material error (`#b00020`) becomes the brand
 * error, and so on.
 *
 * Caching is brand-aware: a different replacement set produces a
 * separate cached sheet so per-render swap cost is constant after
 * the first build.
 */
function getBaseSheet(
  theme: AppTheme,
  replacements?: Record<string, string>,
): CSSStyleSheet {
  const cacheKey = replacements ? `${theme}|${hashReplacements(replacements)}` : theme;
  const cached = baseSheetCache.get(cacheKey);
  if (cached) return cached;

  let css = theme === 'dark' ? primeMdcDarkCss : primeMdcLightCss;
  if (replacements) {
    css = customizeMdcTheme(css, replacements);
  }
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(shadowSafeThemeCss(css));
  baseSheetCache.set(cacheKey, sheet);
  return sheet;
}

function getUtilitiesSheet(): CSSStyleSheet {
  if (utilitiesSheet) return utilitiesSheet;
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(PRIMEREACT_BASE_UTILITIES_CSS);
  utilitiesSheet = sheet;
  return sheet;
}

/**
 * Designer chrome theme — maps SDK `--pseudo-designer-*` tokens to
 * `--vscode-*` host theme variables. Adopted between the utilities
 * sheet and the Forge token overrides so:
 *
 *   - It's strictly an editor-UI concern (not view content).
 *   - Forge defaults / tenant overrides still cascade above it for
 *     consumer-facing tokens (`--p-*`).
 *   - The SDK's own pseudo-ui-react.css (adopted last via renderRoot)
 *     reads the `--pseudo-designer-*` values these definitions set.
 *
 * Only `designer="edit"` mode actually renders nodes with the chrome
 * classes; in other modes this sheet is inert.
 */
function getDesignerChromeSheet(): CSSStyleSheet {
  if (designerChromeSheet) return designerChromeSheet;
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(designerChromeCss);
  designerChromeSheet = sheet;
  return sheet;
}

function getForgeOverrideSheet(theme: AppTheme): CSSStyleSheet {
  const cached = forgeOverrideCache.get(theme);
  if (cached) return cached;
  const tokens = FORGE_DEFAULT_TOKENS[theme];
  const decl = Object.entries(tokens)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`:host {\n${decl}\n}`);
  forgeOverrideCache.set(theme, sheet);
  return sheet;
}

function getTenantSheet(input: Record<string, string> | string | null | undefined): CSSStyleSheet | null {
  const block = buildTenantOverrideBlock(input);
  if (!block) return null;
  const cached = tenantSheetCache.get(block);
  if (cached) return cached;
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(block);
  tenantSheetCache.set(block, sheet);
  return sheet;
}

export interface ThemeLayerInputs {
  appTheme: AppTheme;
  tenant?: Record<string, string> | string | null;
  /**
   * Brand-aware MDC hex replacements. When supplied, PrimeReact's
   * Layer 1 MDC theme is rewritten with the brand's color set before
   * adoption. Produced by `derivePrimeReactReplacements(brandPalette)`
   * in the host frame.
   *
   * `undefined` = no brand JSON active → un-customized MDC theme.
   */
  replacements?: Record<string, string>;
}

/**
 * Atomically replace the shadow root's adopted stylesheets with the
 * full Forge layer stack: base + utilities + Forge defaults +
 * (optional) tenant. The SDK's own `pseudo-ui-react.css` is adopted
 * separately by `<PseudoView renderRoot={shadow}>` and is not
 * touched here.
 */
export function syncThemeLayers(shadow: ShadowRoot, input: ThemeLayerInputs): void {
  const tenantSheet = getTenantSheet(input.tenant);
  const sheets: CSSStyleSheet[] = [
    // Layer 1 — PrimeReact MDC theme. Brand-customized when a brand
    // JSON is active; un-customized otherwise.
    getBaseSheet(input.appTheme, input.replacements),
    getUtilitiesSheet(),
    getDesignerChromeSheet(),
    getForgeOverrideSheet(input.appTheme),
  ];
  if (tenantSheet) sheets.push(tenantSheet);

  // Preserve any SDK-adopted sheets that landed before us
  // (PseudoView's effect may have already pushed
  // `pseudo-ui-react.css`). Identify them by *not* being one of the
  // sheets we manage.
  const managed = new Set<CSSStyleSheet>([
    ...baseSheetCache.values(),
    ...forgeOverrideCache.values(),
    ...tenantSheetCache.values(),
  ]);
  if (utilitiesSheet) managed.add(utilitiesSheet);
  if (designerChromeSheet) managed.add(designerChromeSheet);

  const existingForeign = (shadow.adoptedStyleSheets ?? []).filter((s) => !managed.has(s));
  shadow.adoptedStyleSheets = [...sheets, ...existingForeign];
}
