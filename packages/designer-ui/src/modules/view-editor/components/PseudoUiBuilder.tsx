import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { ViewRenderer } from '@vnext-forge-studio/vnext-types';

import { Badge } from '../../../ui/Badge';
import { Button } from '../../../ui/Button';
import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { JsonCodeField } from '../../../ui/JsonCodeField';
import { Select } from '../../../ui/Select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/Tabs';
import { Textarea } from '../../../ui/Textarea';
import { PseudoUiViewSurface } from '../../quick-run/pseudo-ui/PseudoUiViewSurface';
import type { ViewResponse } from '../../quick-run/types/quickrun.types';

type BuilderNode = Record<string, unknown> & { type: string; children?: BuilderNode[] };
type NodePath = number[];

interface BuilderDefinition extends Record<string, unknown> {
  $schema: string;
  dataSchema: string | Record<string, unknown>;
  lookups?: string[];
  uiState?: Record<string, unknown>;
  view: BuilderNode;
}

interface NodeTemplate {
  category: string;
  description: string;
  template: BuilderNode;
  type: string;
}

interface PseudoUiBuilderProps {
  content: string;
  onContentChange: (content: string) => void;
  viewKey: string;
}

const EMPTY_DEFINITION: BuilderDefinition = {
  $schema: 'https://amorphie.io/schemas/pseudo-ui-view.json',
  dataSchema: '',
  view: {
    type: 'Column',
    gap: 'md',
    children: [{ type: 'Text', content: { en: 'New view' }, variant: 'title' }],
  },
};

export const PSEUDO_UI_BUILDER_NODE_TYPES = [
  'Column',
  'Row',
  'Expanded',
  'ScrollView',
  'Center',
  'Wrap',
  'Spacer',
  'Stack',
  'Grid',
  'Card',
  'Divider',
  'Text',
  'Icon',
  'Image',
  'Chip',
  'Badge',
  'Avatar',
  'ProgressIndicator',
  'LoadingIndicator',
  'ListTile',
  'RichText',
  'TextField',
  'TextArea',
  'NumberField',
  'Dropdown',
  'Checkbox',
  'Switch',
  'RadioGroup',
  'DatePicker',
  'TimePicker',
  'Slider',
  'SegmentedButton',
  'SearchField',
  'AutoComplete',
  'Button',
  'IconButton',
  'FAB',
  'TabView',
  'ExpansionPanel',
  'Stepper',
  'Tooltip',
  'Snackbar',
  'Dialog',
  'BottomSheet',
  'SideSheet',
  'NavigationDrawer',
  'AppBar',
  'Toolbar',
  'NavigationBar',
  'Menu',
  'Carousel',
  'ForEach',
  'Component',
] as const;

const NODE_TEMPLATES: NodeTemplate[] = [
  { category: 'Layout', type: 'Column', description: 'Vertical layout', template: { type: 'Column', gap: 'md', children: [] } },
  { category: 'Layout', type: 'Row', description: 'Horizontal layout', template: { type: 'Row', gap: 'md', children: [] } },
  { category: 'Layout', type: 'Expanded', description: 'Flexible layout child', template: { type: 'Expanded', children: [] } },
  { category: 'Layout', type: 'ScrollView', description: 'Scrollable region', template: { type: 'ScrollView', children: [] } },
  { category: 'Layout', type: 'Center', description: 'Centered content', template: { type: 'Center', children: [] } },
  { category: 'Layout', type: 'Wrap', description: 'Wrapping layout', template: { type: 'Wrap', gap: 'sm', children: [] } },
  { category: 'Layout', type: 'Spacer', description: 'Empty spacing', template: { type: 'Spacer', size: 'md' } },
  { category: 'Layout', type: 'Stack', description: 'Layered content', template: { type: 'Stack', children: [] } },
  { category: 'Layout', type: 'Grid', description: 'Grid layout', template: { type: 'Grid', columns: 2, gap: 'md', children: [] } },
  { category: 'Layout', type: 'Card', description: 'Card container', template: { type: 'Card', variant: 'outlined', children: [] } },
  { category: 'Display', type: 'Divider', description: 'Visual divider', template: { type: 'Divider' } },
  { category: 'Display', type: 'Text', description: 'Localized text', template: { type: 'Text', content: { en: 'Text' }, variant: 'body' } },
  { category: 'Display', type: 'Icon', description: 'Prime icon', template: { type: 'Icon', icon: 'info' } },
  { category: 'Display', type: 'Image', description: 'Image URL', template: { type: 'Image', src: '', alt: { en: 'Image' } } },
  { category: 'Display', type: 'Chip', description: 'Compact label', template: { type: 'Chip', label: { en: 'Chip' } } },
  { category: 'Display', type: 'Badge', description: 'Status badge', template: { type: 'Badge', label: { en: 'Badge' } } },
  { category: 'Display', type: 'Avatar', description: 'Avatar', template: { type: 'Avatar', label: 'A' } },
  { category: 'Display', type: 'ProgressIndicator', description: 'Progress bar', template: { type: 'ProgressIndicator', value: 50 } },
  { category: 'Display', type: 'LoadingIndicator', description: 'Loading spinner', template: { type: 'LoadingIndicator' } },
  { category: 'Display', type: 'ListTile', description: 'List row', template: { type: 'ListTile', title: { en: 'Title' }, subtitle: { en: 'Subtitle' } } },
  { category: 'Display', type: 'RichText', description: 'Rich text block', template: { type: 'RichText', content: { en: '<b>Rich text</b>' } } },
  { category: 'Input', type: 'TextField', description: 'Text input', template: { type: 'TextField', bind: 'fieldName', variant: 'outlined' } },
  { category: 'Input', type: 'TextArea', description: 'Long text input', template: { type: 'TextArea', bind: 'description', rows: 3 } },
  { category: 'Input', type: 'NumberField', description: 'Number input', template: { type: 'NumberField', bind: 'amount' } },
  { category: 'Input', type: 'Dropdown', description: 'Enum or LOV select', template: { type: 'Dropdown', bind: 'selection' } },
  { category: 'Input', type: 'Checkbox', description: 'Boolean checkbox', template: { type: 'Checkbox', bind: 'accepted' } },
  { category: 'Input', type: 'Switch', description: 'Boolean switch', template: { type: 'Switch', bind: 'enabled' } },
  { category: 'Input', type: 'RadioGroup', description: 'Enum radio group', template: { type: 'RadioGroup', bind: 'choice' } },
  { category: 'Input', type: 'DatePicker', description: 'Date input', template: { type: 'DatePicker', bind: 'date' } },
  { category: 'Input', type: 'TimePicker', description: 'Time input', template: { type: 'TimePicker', bind: 'time' } },
  { category: 'Input', type: 'Slider', description: 'Numeric slider', template: { type: 'Slider', bind: 'score', min: 0, max: 100 } },
  { category: 'Input', type: 'SegmentedButton', description: 'Segmented choice', template: { type: 'SegmentedButton', bind: 'segment' } },
  { category: 'Input', type: 'SearchField', description: 'Search input', template: { type: 'SearchField', bind: 'query' } },
  { category: 'Input', type: 'AutoComplete', description: 'Autocomplete input', template: { type: 'AutoComplete', bind: 'city' } },
  { category: 'Action', type: 'Button', description: 'Action button', template: { type: 'Button', label: { en: 'Continue' }, action: 'submit', command: 'next' } },
  { category: 'Action', type: 'IconButton', description: 'Icon action', template: { type: 'IconButton', icon: 'settings', action: 'submit', command: 'settings' } },
  { category: 'Action', type: 'FAB', description: 'Floating action', template: { type: 'FAB', icon: 'add', action: 'submit', command: 'add' } },
  { category: 'Collection', type: 'TabView', description: 'Tabbed content', template: { type: 'TabView', tabs: [{ title: { en: 'Tab' }, content: [{ type: 'Text', content: { en: 'Tab content' } }] }] } },
  { category: 'Collection', type: 'ExpansionPanel', description: 'Expandable panel', template: { type: 'ExpansionPanel', title: { en: 'Details' }, children: [] } },
  { category: 'Collection', type: 'Stepper', description: 'Stepper flow', template: { type: 'Stepper', steps: [{ title: { en: 'Step' }, content: [{ type: 'Text', content: { en: 'Step content' } }] }] } },
  { category: 'Feedback', type: 'Tooltip', description: 'Tooltip wrapper', template: { type: 'Tooltip', text: { en: 'Helpful hint' }, children: [] } },
  { category: 'Feedback', type: 'Snackbar', description: 'Snackbar message', template: { type: 'Snackbar', visible: false, message: { en: 'Saved' } } },
  { category: 'Feedback', type: 'Dialog', description: 'Modal dialog', template: { type: 'Dialog', title: { en: 'Dialog' }, visible: false, children: [], actions: [] } },
  { category: 'Feedback', type: 'BottomSheet', description: 'Bottom sheet', template: { type: 'BottomSheet', title: { en: 'Sheet' }, visible: false, children: [] } },
  { category: 'Feedback', type: 'SideSheet', description: 'Side sheet', template: { type: 'SideSheet', title: { en: 'Sheet' }, visible: false, children: [] } },
  { category: 'Navigation', type: 'NavigationDrawer', description: 'Navigation drawer', template: { type: 'NavigationDrawer', visible: false, items: [] } },
  { category: 'Navigation', type: 'AppBar', description: 'Top app bar', template: { type: 'AppBar', title: { en: 'Title' }, actions: [] } },
  { category: 'Navigation', type: 'Toolbar', description: 'Toolbar', template: { type: 'Toolbar', children: [] } },
  { category: 'Navigation', type: 'NavigationBar', description: 'Bottom navigation', template: { type: 'NavigationBar', items: [{ label: { en: 'Home' }, icon: 'home' }] } },
  { category: 'Navigation', type: 'Menu', description: 'Popup menu', template: { type: 'Menu', items: [{ label: { en: 'Menu item' }, action: 'submit', command: 'menu' }] } },
  { category: 'Collection', type: 'Carousel', description: 'Carousel', template: { type: 'Carousel', items: [{ type: 'Text', content: { en: 'Slide' } }] } },
  { category: 'Collection', type: 'ForEach', description: 'Repeat template', template: { type: 'ForEach', source: '$form.items', as: 'item', template: { type: 'Text', content: '$item.name' } } },
  { category: 'Nested', type: 'Component', description: 'Nested component', template: { type: 'Component', ref: 'urn:amorphie:view:component', bind: {} } },
];

export function PseudoUiBuilder({ content, onContentChange, viewKey }: PseudoUiBuilderProps) {
  const [selectedPath, setSelectedPath] = useState<NodePath>([]);
  const [mode, setMode] = useState<'builder' | 'json' | 'preview'>('builder');
  const parsed = useMemo(() => parseBuilderDefinition(content, viewKey), [content, viewKey]);
  const bindingFields = useMemo(() => inferBindingFields(parsed.definition), [parsed.definition]);

  function commitDefinition(definition: BuilderDefinition) {
    onContentChange(JSON.stringify(definition, null, 2));
  }

  function updateSelectedNode(updater: (node: BuilderNode) => BuilderNode) {
    commitDefinition(updateNodeAtPath(parsed.definition, selectedPath, updater));
  }

  function addNode(parentPath: NodePath, template: BuilderNode) {
    const nextPath = [...parentPath];
    const nextDefinition = updateNodeAtPath(parsed.definition, parentPath, (node) => {
      const children = Array.isArray(node.children) ? [...node.children] : [];
      nextPath.push(children.length);
      return { ...node, children: [...children, cloneNode(template)] };
    });
    commitDefinition(nextDefinition);
    setSelectedPath(nextPath);
  }

  function removeSelectedNode() {
    if (selectedPath.length === 0) return;
    commitDefinition(removeNodeAtPath(parsed.definition, selectedPath));
    setSelectedPath(selectedPath.slice(0, -1));
  }

  const selectedNode = getNodeAtPath(parsed.definition.view, selectedPath) ?? parsed.definition.view;
  const previewResponse: ViewResponse = {
    key: viewKey === '' ? 'preview' : viewKey,
    content: parsed.definition,
    type: 'Json',
    renderer: ViewRenderer.PseudoUi,
  };

  return (
    <Tabs value={mode} onValueChange={(value) => setMode(value as typeof mode)} className="gap-3">
      <TabsList variant="secondary" className="h-auto flex-wrap justify-start gap-1 p-1">
        <TabsTrigger value="builder" variant="secondary" className="h-7 px-2 text-[10px]">Builder</TabsTrigger>
        <TabsTrigger value="json" variant="secondary" className="h-7 px-2 text-[10px]">JSON</TabsTrigger>
        <TabsTrigger value="preview" variant="secondary" className="h-7 px-2 text-[10px]">Preview</TabsTrigger>
      </TabsList>

      <TabsContent value="builder">
        <div className="grid gap-3 xl:grid-cols-[240px_minmax(0,1fr)_320px]">
          <BuilderPanel title="Node Tree">
            <NodeTree node={parsed.definition.view} selectedPath={selectedPath} onSelect={setSelectedPath} />
          </BuilderPanel>
          <BuilderPanel title="Add Node">
            <NodePalette onAdd={(template) => addNode(selectedPath, template)} />
          </BuilderPanel>
          <BuilderPanel
            title="Inspector"
            action={
              <Button type="button" variant="ghost" size="icon" className="size-7" disabled={selectedPath.length === 0} onClick={removeSelectedNode} title="Remove node">
                <Trash2 size={13} />
              </Button>
            }>
            <NodeInspector
              bindingFields={bindingFields}
              node={selectedNode}
              onChange={updateSelectedNode}
            />
          </BuilderPanel>
        </div>
      </TabsContent>

      <TabsContent value="json">
        <div className="space-y-2">
          {parsed.error ? <p className="text-[11px] text-destructive-text">{parsed.error}</p> : null}
          <JsonCodeField value={content} onChange={onContentChange} language="json" height={420} />
        </div>
      </TabsContent>

      <TabsContent value="preview">
        <div className="min-h-[320px] rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] p-3">
          <PseudoUiViewSurface
            viewResponse={previewResponse}
            mode="preview"
            ariaLabel={`View preview ${viewKey || 'untitled'}`}
            fillHeight={false}
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}

function BuilderPanel({ action, children, title }: { action?: React.ReactNode; children: React.ReactNode; title: string }) {
  return (
    <div className="border-border-subtle bg-surface/60 min-h-0 rounded-md border p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-foreground">{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

function NodeTree({ node, onSelect, selectedPath, path = [] }: { node: BuilderNode; onSelect: (path: NodePath) => void; path?: NodePath; selectedPath: NodePath }) {
  const [expanded, setExpanded] = useState(true);
  const children = Array.isArray(node.children) ? node.children : [];
  const selected = pathEquals(path, selectedPath);
  return (
    <div>
      <div className="flex items-center gap-1">
        {children.length > 0 ? (
          <Button type="button" variant="ghost" size="icon" className="size-5" onClick={() => setExpanded((value) => !value)}>
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </Button>
        ) : <span className="w-5" />}
        <button
          type="button"
          onClick={() => onSelect(path)}
          className={`min-w-0 flex-1 rounded px-1.5 py-1 text-left font-mono text-[11px] ${selected ? 'bg-primary-muted text-primary-text' : 'hover:bg-muted-surface'}`}>
          {node.type}
        </button>
      </div>
      {expanded && children.length > 0 ? (
        <div className="ml-4 border-l border-border-subtle pl-2">
          {children.map((child, index) => (
            <NodeTree key={index} node={child} selectedPath={selectedPath} onSelect={onSelect} path={[...path, index]} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NodePalette({ onAdd }: { onAdd: (template: BuilderNode) => void }) {
  const grouped = groupByCategory(NODE_TEMPLATES);
  return (
    <div className="max-h-[520px] space-y-3 overflow-auto pr-1">
      {Object.entries(grouped).map(([category, templates]) => (
        <div key={category}>
          <p className="text-muted-foreground mb-1 text-[10px] font-semibold uppercase">{category}</p>
          <div className="grid gap-1 md:grid-cols-2 xl:grid-cols-1">
            {templates.map((template) => (
              <button
                type="button"
                key={template.type}
                onClick={() => onAdd(template.template)}
                className="border-border-subtle hover:bg-muted-surface flex items-start gap-2 rounded border px-2 py-1.5 text-left">
                <Plus className="mt-0.5 size-3 shrink-0" />
                <span className="min-w-0">
                  <span className="block font-mono text-[11px]">{template.type}</span>
                  <span className="text-muted-foreground block text-[10px]">{template.description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function NodeInspector({ bindingFields, node, onChange }: { bindingFields: string[]; node: BuilderNode; onChange: (updater: (node: BuilderNode) => BuilderNode) => void }) {
  const [rawError, setRawError] = useState<string | null>(null);
  const raw = JSON.stringify(node, null, 2);

  function setField(key: string, value: unknown) {
    onChange((current) => {
      const next = { ...current };
      if (value === '' || value === undefined) delete next[key];
      else next[key] = value;
      return next;
    });
  }

  function setAction(value: string) {
    setField('action', value || undefined);
  }

  function setRaw(value: string) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!isBuilderNode(parsed)) {
        setRawError('Node JSON must include a string type.');
        return;
      }
      setRawError(null);
      onChange(() => parsed);
    } catch {
      setRawError('Invalid node JSON.');
    }
  }

  return (
    <div className="max-h-[520px] space-y-3 overflow-auto pr-1">
      <div className="flex items-center gap-2">
        <Badge variant="muted" className="px-1.5 py-0.5 text-[9px]">{node.type}</Badge>
      </div>
      <div className="grid gap-2">
        <Field label="Bind">
          <InputList value={asString(node.bind)} suggestions={bindingFields} onChange={(value) => setField('bind', value)} placeholder="fieldName" />
        </Field>
        <LocalizedOrStringField label="Label" value={node.label} onChange={(value) => setField('label', value)} />
        <LocalizedOrStringField label="Content" value={node.content} onChange={(value) => setField('content', value)} />
        <LocalizedOrStringField label="Title" value={node.title} onChange={(value) => setField('title', value)} />
        <Field label="Variant">
          <Input size="sm" value={asString(node.variant)} onChange={(event) => setField('variant', event.target.value)} placeholder="outlined" />
        </Field>
        <Field label="Icon">
          <Input size="sm" value={asString(node.icon)} onChange={(event) => setField('icon', event.target.value)} placeholder="info" />
        </Field>
        <Field label="Action">
          <Select className="h-8 text-xs" value={asString(node.action)} onChange={(event) => setAction(event.target.value)}>
            <option value="">None</option>
            <option value="submit">submit</option>
            <option value="cancel">cancel</option>
            <option value="back">back</option>
          </Select>
        </Field>
        <Field label="Command">
          <Input size="sm" value={asString(node.command)} onChange={(event) => setField('command', event.target.value)} placeholder="transition-id" />
        </Field>
        <Field label="Source / Ref">
          <Input size="sm" value={asString(node.source ?? node.ref)} onChange={(event) => setField(node.type === 'Component' ? 'ref' : 'source', event.target.value)} placeholder="$form.items" />
        </Field>
        <Field label="Alias">
          <Input size="sm" value={asString(node.as)} onChange={(event) => setField('as', event.target.value)} placeholder="item" />
        </Field>
      </div>
      <Field label="Raw node JSON" errorMsg={rawError}>
        <Textarea className="min-h-44 font-mono text-xs" value={raw} onChange={(event) => setRaw(event.target.value)} />
      </Field>
    </div>
  );
}

function LocalizedOrStringField({ label, onChange, value }: { label: string; onChange: (value: unknown) => void; value: unknown }) {
  const localized = isRecord(value) ? value : {};
  return (
    <Field label={label}>
      <div className="grid gap-1">
        <Input size="sm" value={asString(isRecord(value) ? localized.en : value)} onChange={(event) => onChange({ ...localized, en: event.target.value })} placeholder={label} />
      </div>
    </Field>
  );
}

function InputList({ onChange, placeholder, suggestions, value }: { onChange: (value: string) => void; placeholder?: string; suggestions: string[]; value: string }) {
  const listId = `pseudo-ui-bindings-${placeholder ?? 'field'}`;
  return (
    <>
      <Input size="sm" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} list={listId} />
      <datalist id={listId}>
        {suggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}
      </datalist>
    </>
  );
}

export function parseBuilderDefinition(content: string, viewKey = 'preview'): { definition: BuilderDefinition; error: string | null } {
  const trimmed = content.trim();
  if (!trimmed) return { definition: { ...EMPTY_DEFINITION, dataSchema: viewKey ? `urn:amorphie:schema:${viewKey}` : '' }, error: null };
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (isViewDefinition(parsed)) return { definition: parsed, error: null };
    if (isBuilderNode(parsed)) return { definition: { ...EMPTY_DEFINITION, view: parsed }, error: null };
    return { definition: EMPTY_DEFINITION, error: 'Content must be a ViewDefinition or ComponentNode object.' };
  } catch {
    return { definition: EMPTY_DEFINITION, error: 'Invalid JSON. Builder is showing a fallback view.' };
  }
}

function isBuilderNode(value: unknown): value is BuilderNode {
  return isRecord(value) && typeof value.type === 'string';
}

function isViewDefinition(value: unknown): value is BuilderDefinition {
  return isRecord(value) && isBuilderNode(value.view);
}

function getNodeAtPath(root: BuilderNode, path: NodePath): BuilderNode | null {
  let node: BuilderNode | null = root;
  for (const index of path) {
    const children: BuilderNode[] = Array.isArray(node.children) ? node.children : [];
    node = children[index] ?? null;
    if (!node) return null;
  }
  return node;
}

function updateNodeAtPath(definition: BuilderDefinition, path: NodePath, updater: (node: BuilderNode) => BuilderNode): BuilderDefinition {
  if (path.length === 0) return { ...definition, view: updater(definition.view) };
  const updateChildren = (node: BuilderNode, depth: number): BuilderNode => {
    const children: BuilderNode[] = Array.isArray(node.children) ? node.children : [];
    const index = path[depth];
    const nextChildren = children.map((child, childIndex) => {
      if (childIndex !== index) return child;
      return depth === path.length - 1 ? updater(child) : updateChildren(child, depth + 1);
    });
    return { ...node, children: nextChildren };
  };
  return { ...definition, view: updateChildren(definition.view, 0) };
}

function removeNodeAtPath(definition: BuilderDefinition, path: NodePath): BuilderDefinition {
  const parentPath = path.slice(0, -1);
  const removeIndex = path[path.length - 1];
  return updateNodeAtPath(definition, parentPath, (node) => ({
    ...node,
    children: (Array.isArray(node.children) ? node.children : []).filter((_, index) => index !== removeIndex),
  }));
}

function cloneNode(node: BuilderNode): BuilderNode {
  return JSON.parse(JSON.stringify(node)) as BuilderNode;
}

function groupByCategory(templates: NodeTemplate[]): Record<string, NodeTemplate[]> {
  return templates.reduce<Record<string, NodeTemplate[]>>((acc, template) => {
    acc[template.category] ??= [];
    acc[template.category].push(template);
    return acc;
  }, {});
}

function inferBindingFields(definition: BuilderDefinition): string[] {
  const schema = isRecord(definition.dataSchema) ? definition.dataSchema : null;
  const properties = isRecord(schema?.properties) ? schema.properties : {};
  return Object.keys(properties);
}

function pathEquals(left: NodePath, right: NodePath): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
