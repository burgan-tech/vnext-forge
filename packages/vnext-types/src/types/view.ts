import { type Label } from './label';
import { type ResourceReference } from './state';
import { type ViewType } from '../constants/view-types';

/**
 * The display vocabulary, shared by both client interface modes.
 *
 * One list, not two: SDI and MDI differ in *which* interface the value applies
 * to, not in the presentations available. A view can therefore ask for a popup
 * in a single-document client and a drawer in a multi-document one, drawn from
 * the same set.
 */
export type ViewDisplayValue =
  | 'full-page'
  | 'popup'
  | 'bottom-sheet'
  | 'top-sheet'
  | 'drawer'
  | 'inline';

/**
 * Display for SDI (single-document interface) clients — the presentation a view
 * asks for when it is the only document on screen.
 *
 * An alias of {@link ViewDisplayValue} rather than its own union. The distinct
 * name is kept because it makes {@link ViewDisplayModes} read correctly at call
 * sites, and it leaves a seam if the two vocabularies ever diverge again.
 */
export type SdiDisplay = ViewDisplayValue;

/**
 * Display for MDI (multi-document interface) clients, where several documents
 * sit side by side. Same vocabulary as {@link SdiDisplay}.
 */
export type MdiDisplay = ViewDisplayValue;

/**
 * Per-mode display declaration. At least one member must carry a value — an
 * empty object is rejected by both the JSON schema and runtime component
 * validation, which is why {@link ViewDisplayModes} is not a valid authored
 * value on its own. See `serializeViewDisplay` in `utils/view-display`.
 */
export interface ViewDisplayModes {
  sdi?: SdiDisplay;
  mdi?: MdiDisplay;
}

/**
 * @deprecated Use {@link SdiDisplay}. Retained as an alias because it is
 * exported from the package barrel, so removing it would be a breaking change
 * for any out-of-repo consumer.
 */
export type DisplayStrategy = SdiDisplay;

export interface PlatformOverride {
  platform: 'web' | 'ios' | 'android';
  content: unknown;
  /**
   * SDI-only by design: `platformOverrides` is not part of
   * `view-definition.schema.json` (whose `attributes` is
   * `additionalProperties: false`), so this is a legacy shape that never
   * reaches component validation.
   */
  display?: SdiDisplay;
  type?: ViewType;
}

export interface ViewDefinition {
  key: string;
  version: string;
  domain: string;
  flow?: string;
  type?: ViewType;
  /**
   * Either shape is valid. A bare string declares the SDI display and is the
   * backward-compatible form; the object form declares the display per client
   * mode. Read it with `parseViewDisplay` rather than branching here.
   */
  display?: SdiDisplay | ViewDisplayModes;
  renderer?: string;
  content?: unknown;
  labels?: Label[];
  platformOverrides?: PlatformOverride[];
  loadData?: boolean;
  extensions?: ResourceReference[];
}
