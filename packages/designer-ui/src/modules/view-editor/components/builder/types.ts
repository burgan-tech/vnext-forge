/**
 * Shared types for the pseudo-ui builder.
 *
 * `BuilderNode` intentionally mirrors the pseudo-ui SDK's `ComponentNode`
 * shape — the JSON the builder produces is the same JSON the SDK renders.
 * Anywhere the builder needs to track design-time state that isn't part of
 * the wire format (selection path, drag previews) it lives outside the node
 * so it can never accidentally serialize into the saved view.
 */

export type BuilderNode = Record<string, unknown> & {
  type: string;
  children?: BuilderNode[];
};

/**
 * Path of indices from the root `view` node down to a target.
 * Empty path `[]` refers to the root itself.
 * For TabView and ForEach (which keep children in non-`children` slots),
 * we encode the slot transition as part of the path via a string segment
 * so `nodeOps` can navigate cleanly.
 *
 * Example:
 *   `[0, 1]`            → view.children[0].children[1]
 *   `[0, 'tabs', 1, 'content', 0]` → view.children[0].tabs[1].content[0]
 *   `[0, 'template']`   → view.children[0].template
 */
export type NodePath = readonly (number | string)[];

export interface BuilderDefinition extends Record<string, unknown> {
  $schema: string;
  dataSchema: string | Record<string, unknown>;
  lookups?: string[];
  uiState?: Record<string, unknown>;
  view: BuilderNode;
}

export const PSEUDO_UI_VIEW_SCHEMA_URL =
  'https://amorphie.io/schemas/pseudo-ui-view.json';

/** Catalog metadata for a single pseudo-ui component type. */
export interface ComponentMeta {
  type: string;
  category: ComponentCategory;
  label: string;
  /** Lucide icon name — palette shows it next to the label. */
  iconName: LucideIconName;
  /** Sensible defaults applied when this component is dropped onto the canvas. */
  defaultProps: Partial<BuilderNode>;
  /** Whether dropping other nodes into this one is allowed. */
  acceptsChildren: boolean;
  /**
   * For containers whose children live outside `children` (ForEach.template,
   * TabView.tabs[i].content). The string is the key on the node where the
   * collection lives, or `'template'` for the single-child slot.
   */
  childContainerKey?: 'children' | 'template' | 'tabs';
  /** Short one-liner shown in the palette / inspector header. */
  description?: string;
  /** Property editor descriptors — drives the inspector form. */
  propertySchema: PropertyField[];
}

export type ComponentCategory =
  | 'Layout'
  | 'Container'
  | 'Input'
  | 'Display'
  | 'Action'
  | 'Overlay'
  | 'Navigation'
  | 'Other';

/** Lucide icon names we use (typed loosely; lookup happens in the palette). */
export type LucideIconName = string;

/** A single editable property on a node. */
export type PropertyField =
  | TextField
  | NumberField
  | SelectField
  | BindField
  | ActionField
  | IconField
  | MultiLangField
  | BooleanField
  | TabsField
  | StepsField
  | RawField;

interface FieldBase {
  key: string;
  label: string;
  /** Inspector group/section. Optional — ungrouped fields render first. */
  group?: string;
  /** Optional short hint shown under the input. */
  hint?: string;
  /** When false, hide unless `Show advanced` is toggled in the inspector. */
  advanced?: boolean;
  /** Marked in the inspector UI; not validated. */
  required?: boolean;
}

export interface TextField extends FieldBase {
  kind: 'text';
  placeholder?: string;
}

export interface NumberField extends FieldBase {
  kind: 'number';
  min?: number;
  max?: number;
  step?: number;
}

export interface SelectField extends FieldBase {
  kind: 'select';
  options: readonly { value: string; label: string }[];
  allowEmpty?: boolean;
}

/** Bind picker — when dataSchema is bound, autocompletes property paths. */
export interface BindField extends FieldBase {
  kind: 'bind';
  placeholder?: string;
}

/** Editor for Button.action and Card.onTap. */
export interface ActionField extends FieldBase {
  kind: 'action';
  /** Whether the field accepts an array of action descriptors (Card.onTap). */
  multi?: boolean;
}

export interface IconField extends FieldBase {
  kind: 'icon';
}

/** `{ en: '...', tr: '...' }` editor. Also accepts plain string for legacy. */
export interface MultiLangField extends FieldBase {
  kind: 'multilang';
  placeholder?: string;
  multiline?: boolean;
}

export interface BooleanField extends FieldBase {
  kind: 'boolean';
}

/** TabView.tabs[] — opens a nested editor for the tabs array. */
export interface TabsField extends FieldBase {
  kind: 'tabs';
}

/** Stepper.steps[] — typed editor for the steps array with multi-lang
 *  title/subtitle. Step `content` (component array) is edited via the
 *  outline / canvas, not in this field. */
export interface StepsField extends FieldBase {
  kind: 'steps';
}

/** Raw JSON fallback for any prop the inspector doesn't have a typed field for. */
export interface RawField extends FieldBase {
  kind: 'raw';
}

/** Possible `Button.action` values. */
export const BUTTON_ACTIONS = ['submit', 'cancel', 'back'] as const;
export type ButtonAction = (typeof BUTTON_ACTIONS)[number];

/** Variants we expose for buttons / inputs / cards. */
export const BUTTON_VARIANTS = ['filled', 'outlined', 'text', 'elevated', 'tonal'] as const;
export const INPUT_VARIANTS = ['filled', 'outlined'] as const;
export const CARD_VARIANTS = ['elevated', 'filled', 'outlined'] as const;

/** Spacing tokens used by Column/Row gap. */
export const SPACING_TOKENS = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
export type SpacingToken = (typeof SPACING_TOKENS)[number];

/** Cross/main axis alignment values. */
export const AXIS_ALIGN = ['start', 'center', 'end', 'stretch'] as const;
export const MAIN_AXIS_ALIGN = [
  'start',
  'center',
  'end',
  'spaceBetween',
  'spaceAround',
  'spaceEvenly',
] as const;
