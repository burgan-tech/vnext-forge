/**
 * Pseudo-ui component catalog.
 *
 * Single source of truth for the visual builder. The palette enumerates
 * categories from here; the inspector generates its form from
 * `propertySchema`; the canvas asks `acceptsChildren` / `childContainerKey`
 * before allowing drops.
 *
 * **v0.1.4 split:** Structural metadata (`acceptsChildren`,
 * `childContainerKey`) is now owned by the SDK itself
 * (`@burgan-tech/pseudo-ui` → `getComponentMeta`). This file keeps
 * **UI-only** metadata (Lucide icon for the palette, our category
 * taxonomy, human label, the inspector form descriptors) plus
 * `fallbackDefaults` — our curated starter values that override SDK
 * defaults when they conflict (e.g. SDK uses `spacing` while the
 * adapter renders `gap`).
 *
 * `COMPONENT_CATALOG` is computed at module load by merging both
 * sources. New SDK component types automatically appear in the palette
 * (with a console warning if we haven't curated UI for them yet).
 */

import {
  getComponentMeta as sdkGetComponentMeta,
  listComponentTypes,
  type ComponentMeta as SdkComponentMeta,
} from '@burgan-tech/pseudo-ui';

import {
  AXIS_ALIGN,
  BUTTON_VARIANTS,
  CARD_VARIANTS,
  INPUT_VARIANTS,
  MAIN_AXIS_ALIGN,
  SPACING_TOKENS,
  type BuilderNode,
  type ComponentMeta,
  type PropertyField,
} from '../types';

/**
 * SDK v0.1.4 unified all icon prop surfaces to **Material Icons**
 * (DynamicRenderer.tsx:81-87). Previously we split hints between
 * PrimeIcons (Button/IconButton/FAB/Chip/ListTile) and Material
 * (Icon/AppBar/NavigationBar items); the SDK comment explicitly says
 * PrimeReact `icon` props are bypassed in favor of `<i class="material-icons">`
 * children/template so the full Material set is available. One hint
 * model now.
 */
const MATERIAL_ICON_HINT = 'Material Icons name (e.g. info, search, home)';

const spacingOptions = SPACING_TOKENS.map((t) => ({ value: t, label: t }));
const axisOptions = AXIS_ALIGN.map((t) => ({ value: t, label: t }));
const mainAxisOptions = MAIN_AXIS_ALIGN.map((t) => ({ value: t, label: t }));
const buttonVariantOptions = BUTTON_VARIANTS.map((t) => ({ value: t, label: t }));
const inputVariantOptions = INPUT_VARIANTS.map((t) => ({ value: t, label: t }));
const cardVariantOptions = CARD_VARIANTS.map((t) => ({ value: t, label: t }));

const layoutAxisFields: PropertyField[] = [
  { key: 'gap', kind: 'select', label: 'Gap', options: spacingOptions, allowEmpty: true },
  { key: 'mainAxisAlignment', kind: 'select', label: 'Main axis', options: mainAxisOptions, allowEmpty: true, group: 'Alignment' },
  { key: 'crossAxisAlignment', kind: 'select', label: 'Cross axis', options: axisOptions, allowEmpty: true, group: 'Alignment' },
];

const bindableInputFields: PropertyField[] = [
  { key: 'bind', kind: 'bind', label: 'Bind', placeholder: 'e.g. firstName', required: true },
  { key: 'variant', kind: 'select', label: 'Variant', options: inputVariantOptions, allowEmpty: true },
];

const textTypographyVariants = [
  'displayLarge', 'displayMedium', 'displaySmall',
  'headlineLarge', 'headlineMedium', 'headlineSmall',
  'titleLarge', 'titleMedium', 'titleSmall',
  'bodyLarge', 'bodyMedium', 'bodySmall',
  'labelLarge', 'labelMedium', 'labelSmall',
  'title', 'subtitle', 'body', 'caption',
].map((v) => ({ value: v, label: v }));

/**
 * Local UI-side metadata for each component the SDK exposes.
 *
 * Each entry keeps `defaultProps` / `acceptsChildren` / `childContainerKey`
 * **as fallbacks**; at module load `buildCatalog()` merges them with the
 * SDK's structural metadata (SDK wins on `acceptsChildren` /
 * `childContainerKey`, local wins on `defaultProps` so our curated starter
 * shape — e.g. `gap: 'md'` for Column where the SDK metadata says
 * `spacing: 'md'` — survives).
 */
const LOCAL_UI_CATALOG: ComponentMeta[] = [
  // ─── Layout ───────────────────────────────────────────────────────────
  {
    type: 'Column',
    category: 'Layout',
    label: 'Column',
    iconName: 'Rows3',
    description: 'Vertical stack',
    defaultProps: { type: 'Column', gap: 'md', children: [] },
    acceptsChildren: true,
    childContainerKey: 'children',
    propertySchema: layoutAxisFields,
  },
  {
    type: 'Row',
    category: 'Layout',
    label: 'Row',
    iconName: 'Columns3',
    description: 'Horizontal stack',
    defaultProps: { type: 'Row', gap: 'md', children: [] },
    acceptsChildren: true,
    childContainerKey: 'children',
    propertySchema: layoutAxisFields,
  },
  {
    type: 'Expanded',
    category: 'Layout',
    label: 'Expanded',
    iconName: 'Maximize2',
    description: 'Flex grow inside Row/Column',
    defaultProps: { type: 'Expanded', flex: 1, children: [] },
    acceptsChildren: true,
    childContainerKey: 'children',
    propertySchema: [
      { key: 'flex', kind: 'number', label: 'Flex', min: 1, max: 12 },
    ],
  },
  {
    type: 'Wrap',
    category: 'Layout',
    label: 'Wrap',
    iconName: 'WrapText',
    description: 'Flow children with wrapping',
    defaultProps: { type: 'Wrap', gap: 'md', children: [] },
    acceptsChildren: true,
    childContainerKey: 'children',
    propertySchema: [
      { key: 'gap', kind: 'select', label: 'Gap', options: spacingOptions, allowEmpty: true },
    ],
  },
  {
    type: 'Stack',
    category: 'Layout',
    label: 'Stack',
    iconName: 'Layers',
    description: 'Overlapping children',
    defaultProps: { type: 'Stack', children: [] },
    acceptsChildren: true,
    childContainerKey: 'children',
    propertySchema: [],
  },
  {
    type: 'Grid',
    category: 'Layout',
    label: 'Grid',
    iconName: 'LayoutGrid',
    description: 'CSS grid layout',
    defaultProps: { type: 'Grid', columns: 2, gap: 'md', children: [] },
    acceptsChildren: true,
    childContainerKey: 'children',
    propertySchema: [
      { key: 'columns', kind: 'number', label: 'Columns', min: 1, max: 12 },
      { key: 'gap', kind: 'select', label: 'Gap', options: spacingOptions, allowEmpty: true },
    ],
  },
  {
    type: 'Spacer',
    category: 'Layout',
    label: 'Spacer',
    iconName: 'Space',
    description: 'Flexible empty space',
    defaultProps: { type: 'Spacer', flex: 1 },
    acceptsChildren: false,
    propertySchema: [
      { key: 'flex', kind: 'number', label: 'Flex', min: 1, max: 12 },
    ],
  },
  {
    type: 'Center',
    category: 'Layout',
    label: 'Center',
    iconName: 'AlignCenter',
    description: 'Centers a single child',
    defaultProps: { type: 'Center', children: [] },
    acceptsChildren: true,
    childContainerKey: 'children',
    propertySchema: [],
  },
  {
    type: 'ScrollView',
    category: 'Layout',
    label: 'ScrollView',
    iconName: 'Move',
    description: 'Scrollable region',
    defaultProps: { type: 'ScrollView', children: [] },
    acceptsChildren: true,
    childContainerKey: 'children',
    propertySchema: [],
  },

  // ─── Container ────────────────────────────────────────────────────────
  {
    type: 'Card',
    category: 'Container',
    label: 'Card',
    iconName: 'Square',
    description: 'Surface with elevation',
    defaultProps: { type: 'Card', variant: 'elevated', children: [] },
    acceptsChildren: true,
    childContainerKey: 'children',
    propertySchema: [
      { key: 'variant', kind: 'select', label: 'Variant', options: cardVariantOptions, allowEmpty: true },
      // R25.A-6: canonical Card action field. SDK reads `action`
      // (preferred) and `onTap` (legacy alias); the builder writes
      // `action`. Legacy `onTap` values are projected during parse
      // (see `normalizeDefinition.projectCardActionAlias`).
      { key: 'action', kind: 'action', label: 'On tap', multi: true, advanced: true },
    ],
  },
  {
    type: 'ExpansionPanel',
    category: 'Container',
    label: 'Expansion Panel',
    iconName: 'ChevronDownSquare',
    description: 'Collapsible accordion',
    defaultProps: { type: 'ExpansionPanel', title: { en: 'Section' }, children: [] },
    acceptsChildren: true,
    childContainerKey: 'children',
    propertySchema: [
      { key: 'title', kind: 'multilang', label: 'Title' },
      { key: 'expanded', kind: 'boolean', label: 'Expanded by default' },
    ],
  },
  {
    type: 'Stepper',
    category: 'Container',
    label: 'Stepper',
    iconName: 'ListOrdered',
    description: 'Sequential steps',
    defaultProps: { type: 'Stepper', steps: [] },
    acceptsChildren: false,
    propertySchema: [
      { key: 'steps', kind: 'steps', label: 'Steps', hint: 'Title + subtitle (multi-language). Step content children are edited from the outline.' },
      { key: 'activeStep', kind: 'number', label: 'Active step', min: 0 },
    ],
  },
  {
    type: 'TabView',
    category: 'Container',
    label: 'Tab View',
    iconName: 'PanelTopOpen',
    description: 'Tabbed content',
    defaultProps: {
      type: 'TabView',
      tabs: [
        { title: { en: 'Tab 1' }, content: [] },
        { title: { en: 'Tab 2' }, content: [] },
      ],
    },
    acceptsChildren: true,
    childContainerKey: 'tabs',
    propertySchema: [
      { key: 'tabs', kind: 'tabs', label: 'Tabs' },
    ],
  },
  {
    type: 'Divider',
    category: 'Container',
    label: 'Divider',
    iconName: 'Minus',
    description: 'Horizontal rule',
    defaultProps: { type: 'Divider' },
    acceptsChildren: false,
    propertySchema: [],
  },

  // ─── Input ────────────────────────────────────────────────────────────
  {
    type: 'TextField',
    category: 'Input',
    label: 'Text Field',
    iconName: 'Type',
    description: 'Single-line text input',
    defaultProps: { type: 'TextField', bind: '', variant: 'outlined' },
    acceptsChildren: false,
    propertySchema: bindableInputFields,
  },
  {
    type: 'TextArea',
    category: 'Input',
    label: 'Text Area',
    iconName: 'AlignLeft',
    description: 'Multi-line text input',
    defaultProps: { type: 'TextArea', bind: '', variant: 'outlined' },
    acceptsChildren: false,
    propertySchema: [...bindableInputFields],
  },
  {
    type: 'NumberField',
    category: 'Input',
    label: 'Number Field',
    iconName: 'Hash',
    description: 'Numeric input',
    defaultProps: { type: 'NumberField', bind: '', variant: 'outlined' },
    acceptsChildren: false,
    propertySchema: [...bindableInputFields],
  },
  {
    type: 'Dropdown',
    category: 'Input',
    label: 'Dropdown',
    iconName: 'ChevronDown',
    description: 'Select from list',
    defaultProps: { type: 'Dropdown', bind: '', variant: 'outlined' },
    acceptsChildren: false,
    propertySchema: bindableInputFields,
  },
  {
    type: 'Checkbox',
    category: 'Input',
    label: 'Checkbox',
    iconName: 'CheckSquare',
    description: 'Boolean toggle',
    defaultProps: { type: 'Checkbox', bind: '' },
    acceptsChildren: false,
    propertySchema: [{ key: 'bind', kind: 'bind', label: 'Bind', required: true }],
  },
  {
    type: 'RadioGroup',
    category: 'Input',
    label: 'Radio Group',
    iconName: 'CircleDot',
    description: 'Single-choice options (from bound schema property enum)',
    defaultProps: { type: 'RadioGroup', bind: '' },
    acceptsChildren: false,
    propertySchema: [
      { key: 'bind', kind: 'bind', label: 'Bind', required: true },
    ],
  },
  {
    type: 'Switch',
    category: 'Input',
    label: 'Switch',
    iconName: 'ToggleLeft',
    description: 'On/off toggle',
    defaultProps: { type: 'Switch', bind: '' },
    acceptsChildren: false,
    propertySchema: [{ key: 'bind', kind: 'bind', label: 'Bind', required: true }],
  },
  {
    type: 'DatePicker',
    category: 'Input',
    label: 'Date Picker',
    iconName: 'Calendar',
    description: 'Date input',
    defaultProps: { type: 'DatePicker', bind: '', variant: 'outlined' },
    acceptsChildren: false,
    propertySchema: bindableInputFields,
  },
  {
    type: 'TimePicker',
    category: 'Input',
    label: 'Time Picker',
    iconName: 'Clock',
    description: 'Time input',
    defaultProps: { type: 'TimePicker', bind: '', variant: 'outlined' },
    acceptsChildren: false,
    propertySchema: [
      ...bindableInputFields,
      { key: 'hourFormat', kind: 'select', label: 'Hour format', options: [
        { value: '12', label: '12-hour' }, { value: '24', label: '24-hour' },
      ], allowEmpty: true },
    ],
  },
  {
    type: 'Slider',
    category: 'Input',
    label: 'Slider',
    iconName: 'SlidersHorizontal',
    description: 'Range slider (min/max come from schema minimum/maximum)',
    defaultProps: { type: 'Slider', bind: '' },
    acceptsChildren: false,
    propertySchema: [
      { key: 'bind', kind: 'bind', label: 'Bind', required: true },
    ],
  },
  {
    type: 'SegmentedButton',
    category: 'Input',
    label: 'Segmented Button',
    iconName: 'BetweenHorizontalStart',
    description: 'Pill-style choice group',
    defaultProps: { type: 'SegmentedButton', bind: '' },
    acceptsChildren: false,
    propertySchema: [
      { key: 'bind', kind: 'bind', label: 'Bind', required: true },
      { key: 'multiSelect', kind: 'boolean', label: 'Multi-select' },
    ],
  },
  {
    type: 'SearchField',
    category: 'Input',
    label: 'Search Field',
    iconName: 'Search',
    description: 'Text input with search affordance',
    defaultProps: { type: 'SearchField', bind: '', variant: 'outlined' },
    acceptsChildren: false,
    propertySchema: bindableInputFields,
  },
  {
    type: 'AutoComplete',
    category: 'Input',
    label: 'AutoComplete',
    iconName: 'Sparkles',
    description: 'Typeahead with suggestions from x-lov',
    defaultProps: { type: 'AutoComplete', bind: '', variant: 'outlined' },
    acceptsChildren: false,
    propertySchema: [
      ...bindableInputFields,
      { key: 'minLength', kind: 'number', label: 'Min chars', min: 0 },
    ],
  },

  // ─── Display ──────────────────────────────────────────────────────────
  {
    type: 'Text',
    category: 'Display',
    label: 'Text',
    iconName: 'TextCursor',
    description: 'Static text / label',
    defaultProps: { type: 'Text', content: { en: 'Text' } },
    acceptsChildren: false,
    propertySchema: [
      { key: 'content', kind: 'multilang', label: 'Content', multiline: true, required: true },
      { key: 'variant', kind: 'select', label: 'Variant', options: textTypographyVariants, allowEmpty: true },
    ],
  },
  {
    type: 'Icon',
    category: 'Display',
    label: 'Icon',
    iconName: 'Smile',
    description: 'Material icon by name',
    defaultProps: { type: 'Icon', name: 'info' },
    acceptsChildren: false,
    propertySchema: [
      { key: 'name', kind: 'icon', label: 'Icon', required: true, hint: MATERIAL_ICON_HINT },
      { key: 'size', kind: 'number', label: 'Size', min: 8, max: 96 },
    ],
  },
  {
    type: 'Image',
    category: 'Display',
    label: 'Image',
    iconName: 'Image',
    description: 'External image',
    defaultProps: { type: 'Image', source: '' },
    acceptsChildren: false,
    propertySchema: [
      { key: 'source', kind: 'text', label: 'Source URL or expression', required: true },
      { key: 'fit', kind: 'select', label: 'Fit', options: [
        { value: 'cover', label: 'cover' }, { value: 'contain', label: 'contain' },
        { value: 'fill', label: 'fill' },
      ], allowEmpty: true },
    ],
  },
  {
    type: 'Chip',
    category: 'Display',
    label: 'Chip',
    iconName: 'Tag',
    description: 'Compact descriptor',
    defaultProps: { type: 'Chip', label: { en: 'Chip' } },
    acceptsChildren: false,
    propertySchema: [
      { key: 'label', kind: 'multilang', label: 'Label' },
      { key: 'icon', kind: 'icon', label: 'Icon', advanced: true, hint: MATERIAL_ICON_HINT },
      { key: 'variant', kind: 'select', label: 'Variant', options: [
        { value: 'filled', label: 'filled' }, { value: 'outlined', label: 'outlined' },
      ], allowEmpty: true },
    ],
  },
  {
    type: 'Badge',
    category: 'Display',
    label: 'Badge',
    iconName: 'BadgeCheck',
    description: 'Badge overlay on a child widget',
    // `children` holds the one badged componentNode — vocabulary enforces min/max=1.
    // We expose it through the standard children container so the outline +
    // canvas drop targets work without extra slot handling.
    defaultProps: { type: 'Badge', content: { en: '' }, children: [] },
    acceptsChildren: true,
    childContainerKey: 'children',
    propertySchema: [
      { key: 'content', kind: 'multilang', label: 'Content', required: true },
    ],
  },
  {
    type: 'ProgressIndicator',
    category: 'Display',
    label: 'Progress',
    iconName: 'LoaderCircle',
    description: 'Loading indicator',
    defaultProps: { type: 'ProgressIndicator' },
    acceptsChildren: false,
    propertySchema: [
      { key: 'variant', kind: 'select', label: 'Variant', options: [
        { value: 'circular', label: 'circular' }, { value: 'linear', label: 'linear' },
      ], allowEmpty: true },
    ],
  },
  {
    type: 'LoadingIndicator',
    category: 'Display',
    label: 'Loading',
    iconName: 'Loader',
    description: 'M3 loading indicator (animated dots)',
    defaultProps: { type: 'LoadingIndicator' },
    acceptsChildren: false,
    propertySchema: [],
  },
  {
    type: 'ListTile',
    category: 'Display',
    label: 'List Tile',
    iconName: 'List',
    description: 'Row with leading, title, trailing slots',
    defaultProps: { type: 'ListTile', title: { en: 'Title' } },
    acceptsChildren: false,
    propertySchema: [
      { key: 'title', kind: 'multilang', label: 'Title', required: true },
      { key: 'subtitle', kind: 'multilang', label: 'Subtitle' },
      { key: 'leading', kind: 'node-slot', label: 'Leading',
        acceptTypes: ['Icon', 'Avatar', 'IconButton', 'Image'] },
      { key: 'trailing', kind: 'node-slot', label: 'Trailing',
        acceptTypes: ['Icon', 'IconButton', 'Switch', 'Checkbox', 'Chip'] },
      { key: 'onTap', kind: 'action', label: 'On tap', multi: true, advanced: true },
    ],
  },
  {
    type: 'Avatar',
    category: 'Display',
    label: 'Avatar',
    iconName: 'User',
    description: 'User or entity avatar (image / initials / icon)',
    defaultProps: { type: 'Avatar' },
    acceptsChildren: false,
    propertySchema: [
      { key: 'source', kind: 'text', label: 'Image URL or expression' },
      { key: 'label', kind: 'multilang', label: 'Initials' },
      { key: 'icon', kind: 'icon', label: 'Fallback icon', hint: MATERIAL_ICON_HINT },
      { key: 'shape', kind: 'select', label: 'Shape', options: [
        { value: 'circle', label: 'circle' }, { value: 'square', label: 'square' },
      ], allowEmpty: true },
      { key: 'size', kind: 'select', label: 'Size', options: [
        { value: 'sm', label: 'sm' }, { value: 'md', label: 'md' },
        { value: 'lg', label: 'lg' }, { value: 'xl', label: 'xl' },
      ], allowEmpty: true },
    ],
  },
  {
    type: 'RichText',
    category: 'Display',
    label: 'Rich Text',
    iconName: 'FileText',
    description: 'Styled multi-span text',
    defaultProps: { type: 'RichText', spans: [{ text: { en: '' } }] },
    acceptsChildren: false,
    propertySchema: [
      { key: 'spans', kind: 'spans', label: 'Spans', required: true },
    ],
  },

  // ─── Action ───────────────────────────────────────────────────────────
  {
    type: 'Button',
    category: 'Action',
    label: 'Button',
    iconName: 'MousePointerClick',
    description: 'Primary call-to-action',
    defaultProps: { type: 'Button', label: { en: 'Button' }, variant: 'filled', action: 'submit' },
    acceptsChildren: false,
    propertySchema: [
      { key: 'label', kind: 'multilang', label: 'Label', required: true },
      { key: 'variant', kind: 'select', label: 'Variant', options: buttonVariantOptions, allowEmpty: true },
      { key: 'icon', kind: 'icon', label: 'Icon', advanced: true, hint: MATERIAL_ICON_HINT },
      { key: 'action', kind: 'action', label: 'Action', required: true },
      // R24.2 — Canonical workflow transition pattern is
      // action="submit" + this URN. SDK forwards `command` opaquely
      // to delegate.onAction; Forge parses the trailing segment to
      // identify the transition (see resolveTransitionKey.ts).
      {
        key: 'command',
        kind: 'text',
        label: 'Command (URN)',
        advanced: true,
        hint: 'For workflow transitions: urn:amorphie:transition:<domain>:<workflow>:<instance>:<transition-name>',
      },
    ],
  },
  {
    type: 'IconButton',
    category: 'Action',
    label: 'Icon Button',
    iconName: 'Circle',
    description: 'Icon-only button',
    defaultProps: { type: 'IconButton', icon: 'info', action: 'submit' },
    acceptsChildren: false,
    propertySchema: [
      { key: 'icon', kind: 'icon', label: 'Icon', required: true, hint: MATERIAL_ICON_HINT },
      { key: 'action', kind: 'action', label: 'Action', required: true },
    ],
  },
  {
    type: 'FAB',
    category: 'Action',
    label: 'FAB',
    iconName: 'Plus',
    description: 'Floating action button',
    defaultProps: { type: 'FAB', icon: 'add', action: 'submit' },
    acceptsChildren: false,
    propertySchema: [
      { key: 'icon', kind: 'icon', label: 'Icon', required: true, hint: MATERIAL_ICON_HINT },
      { key: 'label', kind: 'multilang', label: 'Label', advanced: true },
      { key: 'action', kind: 'action', label: 'Action', required: true },
      { key: 'variant', kind: 'select', label: 'Variant', options: [
        { value: 'small', label: 'small' }, { value: 'regular', label: 'regular' },
        { value: 'large', label: 'large' },
      ], allowEmpty: true },
    ],
  },

  // ─── Overlay ──────────────────────────────────────────────────────────
  {
    type: 'Dialog',
    category: 'Overlay',
    label: 'Dialog',
    iconName: 'MessageSquare',
    description: 'Modal dialog with title, content, and actions',
    defaultProps: { type: 'Dialog', visible: '$ui.showDialog', title: { en: 'Title' }, children: [] },
    acceptsChildren: true,
    childContainerKey: 'children',
    propertySchema: [
      { key: 'visible', kind: 'bind', label: 'Visible (uiState bind)', required: true, hint: 'e.g. $ui.showDialog' },
      { key: 'title', kind: 'multilang', label: 'Title', required: true },
      { key: 'icon', kind: 'icon', label: 'Hero icon', hint: MATERIAL_ICON_HINT, advanced: true },
      { key: 'dismissible', kind: 'boolean', label: 'Dismissible' },
      { key: 'actions', kind: 'node-slot', label: 'Actions', multi: true,
        acceptTypes: ['Button', 'IconButton'] },
    ],
  },
  {
    type: 'BottomSheet',
    category: 'Overlay',
    label: 'Bottom Sheet',
    iconName: 'PanelBottomOpen',
    description: 'Bottom slide-up sheet',
    defaultProps: { type: 'BottomSheet', visible: '$ui.showSheet', children: [] },
    acceptsChildren: true,
    childContainerKey: 'children',
    propertySchema: [
      { key: 'visible', kind: 'bind', label: 'Visible (uiState bind)', required: true },
      { key: 'variant', kind: 'select', label: 'Variant', options: [
        { value: 'standard', label: 'standard' }, { value: 'modal', label: 'modal' },
      ], allowEmpty: true },
      { key: 'dragHandle', kind: 'boolean', label: 'Drag handle' },
    ],
  },
  {
    type: 'SideSheet',
    category: 'Overlay',
    label: 'Side Sheet',
    iconName: 'PanelRightOpen',
    description: 'Right side sheet',
    defaultProps: { type: 'SideSheet', visible: '$ui.showSheet', children: [] },
    acceptsChildren: true,
    childContainerKey: 'children',
    propertySchema: [
      { key: 'visible', kind: 'bind', label: 'Visible (uiState bind)', required: true },
      { key: 'variant', kind: 'select', label: 'Variant', options: [
        { value: 'standard', label: 'standard' }, { value: 'modal', label: 'modal' },
      ], allowEmpty: true },
      { key: 'title', kind: 'multilang', label: 'Title' },
    ],
  },
  {
    type: 'Snackbar',
    category: 'Overlay',
    label: 'Snackbar',
    iconName: 'MessageCircle',
    description: 'Transient bottom message',
    defaultProps: { type: 'Snackbar', content: { en: '' } },
    acceptsChildren: false,
    propertySchema: [
      { key: 'content', kind: 'multilang', label: 'Content', required: true },
      { key: 'duration', kind: 'number', label: 'Duration (ms)', min: 0 },
      { key: 'action', kind: 'action', label: 'Action', advanced: true },
      { key: 'variant', kind: 'select', label: 'Variant', options: [
        { value: 'standard', label: 'standard' }, { value: 'success', label: 'success' },
        { value: 'error', label: 'error' }, { value: 'warning', label: 'warning' },
        { value: 'info', label: 'info' },
      ], allowEmpty: true },
    ],
  },
  {
    type: 'Tooltip',
    category: 'Overlay',
    label: 'Tooltip',
    iconName: 'HelpCircle',
    description: 'Hover hint wrapper',
    defaultProps: { type: 'Tooltip', content: { en: 'Hint' }, children: [] },
    acceptsChildren: true,
    childContainerKey: 'children',
    propertySchema: [
      { key: 'content', kind: 'multilang', label: 'Content', required: true },
      { key: 'variant', kind: 'select', label: 'Variant', options: [
        { value: 'plain', label: 'plain' }, { value: 'rich', label: 'rich' },
      ], allowEmpty: true },
    ],
  },

  // ─── Navigation ───────────────────────────────────────────────────────
  {
    type: 'AppBar',
    category: 'Navigation',
    label: 'App Bar',
    iconName: 'PanelTop',
    description: 'Top app bar with title and actions',
    defaultProps: { type: 'AppBar', title: { en: 'Title' } },
    acceptsChildren: false,
    propertySchema: [
      { key: 'title', kind: 'multilang', label: 'Title', required: true },
      { key: 'variant', kind: 'select', label: 'Variant', options: [
        { value: 'center', label: 'center' }, { value: 'small', label: 'small' },
        { value: 'medium', label: 'medium' }, { value: 'large', label: 'large' },
      ], allowEmpty: true },
      { key: 'leading', kind: 'node-slot', label: 'Leading',
        acceptTypes: ['IconButton', 'Icon'] },
      { key: 'actions', kind: 'node-slot', label: 'Actions', multi: true,
        acceptTypes: ['IconButton', 'Button', 'Chip'] },
    ],
  },
  {
    type: 'NavigationBar',
    category: 'Navigation',
    label: 'Navigation Bar',
    iconName: 'PanelBottom',
    description: 'Bottom navigation (3-5 destinations)',
    defaultProps: { type: 'NavigationBar', bind: '', destinations: [] },
    acceptsChildren: false,
    propertySchema: [
      { key: 'bind', kind: 'bind', label: 'Bind', required: true },
      { key: 'destinations', kind: 'raw', label: 'Destinations (array)', required: true,
        hint: 'array<{ icon, label, value?, selectedIcon? }>' },
    ],
  },
  {
    type: 'NavigationDrawer',
    category: 'Navigation',
    label: 'Navigation Drawer',
    iconName: 'PanelLeft',
    description: 'Side navigation drawer',
    defaultProps: { type: 'NavigationDrawer', items: [] },
    acceptsChildren: false,
    propertySchema: [
      { key: 'variant', kind: 'select', label: 'Variant', options: [
        { value: 'standard', label: 'standard' }, { value: 'modal', label: 'modal' },
      ], allowEmpty: true },
      { key: 'visible', kind: 'bind', label: 'Visible (uiState bind)' },
      // R25.A-5: items[] uses the typed picker. Each entry is one of
      // tappable / divider / section header; the tappable variant
      // pulls the same workflow + function URN dialog the Button
      // ActionEditor uses, gated by `itemActionCapability`.
      { key: 'items', kind: 'items', label: 'Items', required: true,
        hint: 'array<{ icon?, label, action, command?, validate?, badge? } | { divider: true } | { header: textContent }>' },
    ],
  },
  {
    type: 'Menu',
    category: 'Navigation',
    label: 'Menu',
    iconName: 'Menu',
    description: 'Popup menu',
    defaultProps: { type: 'Menu', items: [] },
    acceptsChildren: false,
    propertySchema: [
      { key: 'items', kind: 'items', label: 'Items', required: true },
    ],
  },
  {
    type: 'Toolbar',
    category: 'Navigation',
    label: 'Toolbar',
    iconName: 'Wrench',
    description: 'Toolbar container',
    defaultProps: { type: 'Toolbar', children: [] },
    acceptsChildren: true,
    childContainerKey: 'children',
    propertySchema: [],
  },

  // ─── Other ────────────────────────────────────────────────────────────
  {
    type: 'Carousel',
    category: 'Other',
    label: 'Carousel',
    iconName: 'GalleryHorizontal',
    description: 'Horizontal scrolling content carousel',
    // template is a componentNode slot (R16.2-B); source is an array expression.
    defaultProps: { type: 'Carousel', source: '', template: { type: 'Text', content: { en: '' } } },
    acceptsChildren: false,
    propertySchema: [
      { key: 'source', kind: 'bind', label: 'Source (array expression)', required: true,
        hint: 'e.g. $lov.cities or $form.items' },
      { key: 'template', kind: 'node-slot', label: 'Item template' },
      { key: 'autoPlay', kind: 'boolean', label: 'Auto-play' },
      { key: 'showIndicators', kind: 'boolean', label: 'Show indicators' },
    ],
  },
  {
    type: 'ForEach',
    category: 'Other',
    label: 'ForEach',
    iconName: 'Repeat',
    description: 'Repeat a template over a list',
    defaultProps: {
      type: 'ForEach',
      source: '',
      as: 'item',
      template: { type: 'Text', content: { en: '$item.display' } },
    },
    acceptsChildren: true,
    childContainerKey: 'template',
    propertySchema: [
      { key: 'source', kind: 'text', label: 'Source', required: true, placeholder: 'e.g. $lov.cities' },
      { key: 'as', kind: 'text', label: 'Iteration var', required: true, placeholder: 'item' },
    ],
  },
  {
    type: 'Component',
    category: 'Other',
    label: 'Component (nested)',
    iconName: 'Boxes',
    description: 'Reference another view component',
    defaultProps: { type: 'Component', ref: '' },
    acceptsChildren: false,
    propertySchema: [
      { key: 'ref', kind: 'text', label: 'Component ref (URN)', required: true },
      { key: 'bind', kind: 'raw', label: 'Bind map (string or object)', advanced: true },
    ],
  },
];

const LOCAL_UI_MAP: Record<string, ComponentMeta> = Object.fromEntries(
  LOCAL_UI_CATALOG.map((entry) => [entry.type, entry]),
);

/**
 * Merge SDK structural metadata with our local UI metadata.
 *
 * SDK is the source of truth for `acceptsChildren` and `childContainerKey`
 * (which directly affect drop targeting correctness). Local defaults win on
 * `defaultProps` because the SDK metadata sometimes uses keys the adapter
 * does not actually read (e.g. `spacing` vs the adapter's `gap`); our local
 * starter shapes are verified WYSIWYG.
 */
function mergeWithSdk(local: ComponentMeta, sdk: SdkComponentMeta | undefined): ComponentMeta {
  if (!sdk) return local;
  return {
    ...local,
    acceptsChildren: sdk.acceptsChildren,
    childContainerKey: (sdk.childContainerKey ?? local.childContainerKey) as ComponentMeta['childContainerKey'],
    description: local.description ?? sdk.description,
    defaultProps: { type: local.type, ...(sdk.defaultProps ?? {}), ...local.defaultProps },
  };
}

function buildCatalog(): ComponentMeta[] {
  const sdkTypes = listComponentTypes();
  const out: ComponentMeta[] = [];

  // Preserve local declaration order for categories the palette renders;
  // append any SDK-only types at the end with a defensive fallback so they
  // still appear in the palette even when we forget to curate UI for them.
  for (const local of LOCAL_UI_CATALOG) {
    out.push(mergeWithSdk(local, sdkGetComponentMeta(local.type)));
  }
  for (const type of sdkTypes) {
    if (LOCAL_UI_MAP[type]) continue;
    const sdk = sdkGetComponentMeta(type);
    // eslint-disable-next-line no-console
    console.warn(
      `[componentCatalog] SDK component "${type}" has no local UI metadata; falling back to defaults.`,
    );
    out.push({
      type,
      category: 'Other',
      label: type,
      iconName: 'Square',
      description: sdk?.description,
      defaultProps: { type, ...(sdk?.defaultProps ?? {}) },
      acceptsChildren: sdk?.acceptsChildren ?? false,
      childContainerKey: sdk?.childContainerKey as ComponentMeta['childContainerKey'],
      propertySchema: [],
    });
  }
  return out;
}

/** Public catalog — UI metadata + SDK-blessed structural metadata. */
export const COMPONENT_CATALOG: ComponentMeta[] = buildCatalog();

const COMPONENT_MAP: Record<string, ComponentMeta> = Object.fromEntries(
  COMPONENT_CATALOG.map((entry) => [entry.type, entry]),
);

/** Lookup by node type. Returns undefined for unknown types. */
export function findComponentMeta(type: string): ComponentMeta | undefined {
  return COMPONENT_MAP[type];
}

/** All distinct categories in catalog declaration order. */
export function listCategories(): string[] {
  const seen: string[] = [];
  for (const c of COMPONENT_CATALOG) {
    if (!seen.includes(c.category)) seen.push(c.category);
  }
  return seen;
}

/** Build a fresh node of the given type using its catalog defaults. */
export function createNodeFromCatalog(type: string): BuilderNode {
  const meta = findComponentMeta(type);
  if (!meta) return { type };
  // Deep clone so subsequent edits don't mutate the catalog.
  return JSON.parse(JSON.stringify(meta.defaultProps)) as BuilderNode;
}
