/**
 * The `attributes.display` vocabulary and codec for `sys-views` components.
 *
 * A view's display accepts two authored shapes:
 *
 * ```jsonc
 * "display": "popup"                             // legacy — means sdi: "popup"
 * "display": { "sdi": "popup", "mdi": "drawer" } // both modes
 * "display": { "mdi": "full-page" }              // MDI only
 * ```
 *
 * Everything that reads or writes that field goes through this module — the
 * View editor, the read-only detail surface, monitoring and doc-gen — so the
 * option list, the parse rule and the write rule cannot drift apart. Before
 * this existed the six values were a local `as const` inside the picker with no
 * compile-time link to the type union.
 */

import type { ViewDisplayModes, ViewDisplayValue } from '../types/view';

export interface ViewDisplayOption<TValue extends string> {
  value: TValue;
  label: string;
  description: string;
}

/**
 * The display options offered for **both** modes.
 *
 * One list because SDI and MDI share a vocabulary — the mode says which client
 * interface the value applies to, not which presentations exist. Two named
 * constants would imply a difference that is not there.
 *
 * Ordered for the UI (widest presentation first), not to match the type union.
 * The JSON schema constrains membership, so this list and the schema's display
 * definitions must agree.
 */
export const VIEW_DISPLAY_OPTIONS: readonly ViewDisplayOption<ViewDisplayValue>[] = [
  { value: 'full-page', label: 'Full Page', description: 'Takes the full surface' },
  { value: 'popup', label: 'Popup', description: 'Modal dialog' },
  { value: 'drawer', label: 'Drawer', description: 'Side panel' },
  { value: 'bottom-sheet', label: 'Bottom Sheet', description: 'Slides up' },
  { value: 'top-sheet', label: 'Top Sheet', description: 'Slides down' },
  { value: 'inline', label: 'Inline', description: 'Embedded in place' },
];

const DISPLAY_VALUES: ReadonlySet<string> = new Set(VIEW_DISPLAY_OPTIONS.map((o) => o.value));

/** A non-empty string, trimmed — anything else reads as "not declared". */
function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Read an authored `display` value into its per-mode form.
 *
 * Deliberately tolerant: an unrecognised value is preserved rather than
 * dropped, because the runtime accepts any non-blank string (the vocabulary is
 * documented, not enforced there) and a domain may be piloting a new value.
 * Silently discarding it here would make the editor delete data it does not
 * understand. Membership is the JSON schema's job, and Forge surfaces that as a
 * validation error on save.
 */
export function parseViewDisplay(raw: unknown): ViewDisplayModes {
  const asString = asNonEmptyString(raw);
  if (asString !== undefined) return { sdi: asString as ViewDisplayValue };

  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>;
    const sdi = asNonEmptyString(record.sdi) as ViewDisplayValue | undefined;
    const mdi = asNonEmptyString(record.mdi) as ViewDisplayValue | undefined;
    const modes: ViewDisplayModes = {};
    if (sdi !== undefined) modes.sdi = sdi;
    if (mdi !== undefined) modes.mdi = mdi;
    return modes;
  }

  return {};
}

/**
 * Write a per-mode form back to the authored shape.
 *
 * Mirrors the runtime's `ViewDisplayJsonConverter`: an SDI-only declaration
 * becomes a **bare string**, anything declaring `mdi` becomes an object. That
 * is not cosmetic — without it every save of an existing view would rewrite
 * `"popup"` as `{"sdi":"popup"}` and churn the JSON of every domain repo.
 *
 * Returns `undefined` when neither mode is set; the caller must then **remove**
 * the `display` key. Writing `{}` would fail the schema's `anyOf`, which
 * requires at least one mode, even though `display` itself is optional.
 */
export function serializeViewDisplay(
  modes: ViewDisplayModes,
): ViewDisplayValue | ViewDisplayModes | undefined {
  const sdi = asNonEmptyString(modes.sdi) as ViewDisplayValue | undefined;
  const mdi = asNonEmptyString(modes.mdi) as ViewDisplayValue | undefined;

  if (mdi !== undefined) {
    return sdi !== undefined ? { sdi, mdi } : { mdi };
  }
  return sdi;
}

/**
 * Compact single-line label for read-only surfaces (doc tables, list badges).
 * Surfaces with room for two fields should render the modes separately instead.
 */
export function formatViewDisplay(raw: unknown, emptyText = '—'): string {
  const { sdi, mdi } = parseViewDisplay(raw);
  if (sdi !== undefined && mdi !== undefined) return `SDI: ${sdi} · MDI: ${mdi}`;
  if (mdi !== undefined) return `MDI: ${mdi}`;
  if (sdi !== undefined) return sdi;
  return emptyText;
}

/**
 * Whether a value is in the documented display vocabulary.
 *
 * Mode-agnostic, because SDI and MDI share the list. Note the parser
 * deliberately does *not* apply this — an unrecognised value is preserved so the
 * editor never deletes data it does not understand, and membership stays the
 * JSON schema's call.
 */
export function isKnownViewDisplay(value: unknown): value is ViewDisplayValue {
  return typeof value === 'string' && DISPLAY_VALUES.has(value);
}
