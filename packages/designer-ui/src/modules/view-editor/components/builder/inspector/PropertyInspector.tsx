/**
 * Property inspector — generates a typed form for the currently selected
 * node from its `componentCatalog.propertySchema`.
 *
 * When nothing is selected, the inspector shows the view-level settings
 * panel (dataSchema picker, lookups, uiState) instead.
 */

import { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';

import { Input } from '../../../../../ui/Input';
import { Select } from '../../../../../ui/Select';
import { Textarea } from '../../../../../ui/Textarea';
import { JsonCodeField } from '../../../../../ui/JsonCodeField';
import { findComponentMeta } from '../palette/componentCatalog';
import { getNode } from '../utils/nodeOps';
import { type BuilderStore } from '../state/builderStore';
import { type BuilderNode, type NodePath, type PropertyField } from '../types';
import { ActionEditor } from './ActionEditor';
import type { DataSchema } from '@burgantech/pseudo-ui';

import { BindAutocomplete } from './BindAutocomplete';
import { MultiLangInput } from './MultiLangInput';
import { NodeSlotField } from './NodeSlotField';
import { SpansField } from './SpansField';
import { StepsField } from './StepsField';
import { TabsField } from './TabsField';
import { enumerateBindPaths, type BindPathEntry } from './schemaPaths';
import { ViewSettingsPanel } from '../ViewSettingsPanel';

export interface PropertyInspectorProps {
  store: BuilderStore;
  /** Optional list of project schema components for the dataSchema picker. */
  availableSchemas?: readonly { urn: string; label: string }[];
  /** Resolves a schema URN into its JSON-schema object (for bind autocomplete). */
  loadSchema?: (urn: string) => Promise<unknown>;
}

export function PropertyInspector({ store, availableSchemas, loadSchema }: PropertyInspectorProps) {
  const definition = useStore(store, (s) => s.definition);
  const selectedPath = useStore(store, (s) => s.selectedPath);
  const updateNodeProp = useStore(store, (s) => s.updateNodeProp);
  const deleteNode = useStore(store, (s) => s.deleteNode);
  const duplicateNode = useStore(store, (s) => s.duplicateNode);

  // Schema-driven bind path suggestions. SDK returns rich entries; we keep
  // them around so a future tweak could surface type / format / required
  // alongside the path, but the BindAutocomplete only consumes the flat
  // string paths for now.
  const [bindEntries, setBindEntries] = useState<BindPathEntry[]>([]);
  const bindPaths = useMemo(() => bindEntries.map((e) => e.path), [bindEntries]);

  // Resolve the data schema (string URN → fetched JSON, or inline object).
  useEffect(() => {
    const ds = definition.dataSchema;
    if (typeof ds === 'object' && ds !== null) {
      setBindEntries(enumerateBindPaths(ds as DataSchema));
      return;
    }
    if (typeof ds === 'string' && ds !== '' && loadSchema) {
      let cancelled = false;
      void loadSchema(ds)
        .then((schema) => {
          if (!cancelled) setBindEntries(enumerateBindPaths(schema as DataSchema));
        })
        .catch(() => {
          if (!cancelled) setBindEntries([]);
        });
      return () => {
        cancelled = true;
      };
    }
    setBindEntries([]);
  }, [definition.dataSchema, loadSchema]);

  if (!selectedPath || selectedPath.length === 0) {
    return (
      <ViewSettingsPanel
        store={store}
        availableSchemas={availableSchemas}
        bindEntries={bindEntries}
      />
    );
  }

  const node = getNode(definition.view, selectedPath);
  if (!node) {
    return (
      <div className="p-3 text-[11px] text-muted-text">
        Selected node not found. Pick another from the outline.
      </div>
    );
  }

  const meta = findComponentMeta(node.type);
  if (!meta) {
    return (
      <div className="p-3">
        <p className="mb-2 text-[12px] text-foreground">
          Unknown component type: <code>{node.type}</code>
        </p>
        <p className="text-[11px] text-muted-text">
          Edit this node as raw JSON.
        </p>
      </div>
    );
  }

  const showAdvancedFields = meta.propertySchema.some((f) => f.advanced);

  return (
    <div className="flex h-full min-h-0 flex-col bg-primary-surface">
      <div className="shrink-0 border-b border-primary-border bg-primary-surface p-3">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-secondary-text">
          {meta.category}
        </div>
        <h3 className="text-[13px] font-semibold text-foreground">{meta.label}</h3>
        {meta.description ? (
          <p className="mt-1 text-[11px] text-muted-text">{meta.description}</p>
        ) : null}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className="rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-button-secondaryBackground)] px-2 py-1 text-[10px] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-list-hoverBackground)]"
            onClick={() => duplicateNode(selectedPath)}
          >
            Duplicate
          </button>
          <button
            type="button"
            className="rounded border border-[var(--vscode-inputValidation-errorBorder)] bg-[var(--vscode-button-secondaryBackground)] px-2 py-1 text-[10px] text-[var(--vscode-errorForeground)] hover:bg-[var(--vscode-list-hoverBackground)]"
            onClick={() => deleteNode(selectedPath)}
          >
            Delete
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <PropertySchemaForm
          node={node}
          schema={meta.propertySchema}
          path={selectedPath}
          store={store}
          bindPaths={bindPaths}
          showAdvanced={showAdvancedFields}
          onChange={(key, value) => updateNodeProp(selectedPath, key, value)}
        />
      </div>
    </div>
  );
}

interface PropertySchemaFormProps {
  node: BuilderNode;
  schema: PropertyField[];
  path: NodePath;
  store: BuilderStore;
  bindPaths: string[];
  showAdvanced: boolean;
  onChange: (key: string, value: unknown) => void;
}

function PropertySchemaForm({ node, schema, path, store, bindPaths, showAdvanced, onChange }: PropertySchemaFormProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const visible = schema.filter((f) => !f.advanced);
  const advanced = schema.filter((f) => f.advanced);

  return (
    <div className="flex flex-col gap-2">
      {visible.length === 0 && advanced.length === 0 ? (
        <p className="text-[11px] text-muted-text">
          This component has no editable properties.
        </p>
      ) : null}
      {visible.map((field) => (
        <PropertyFieldRow
          key={field.key}
          field={field}
          value={(node as Record<string, unknown>)[field.key]}
          bindPaths={bindPaths}
          parentPath={path}
          store={store}
          node={node}
          onSiblingChange={(siblingKey, siblingValue) => onChange(siblingKey, siblingValue)}
          onChange={(value) => onChange(field.key, value)}
        />
      ))}
      {showAdvanced && advanced.length > 0 ? (
        <>
          <button
            type="button"
            className="self-start text-[11px] text-[var(--vscode-textLink-foreground)] hover:underline"
            onClick={() => setAdvancedOpen((o) => !o)}
          >
            {advancedOpen ? '▾' : '▸'} Advanced
          </button>
          {advancedOpen ? (
            <div className="flex flex-col gap-3 border-l border-[var(--vscode-panel-border)] pl-2">
              {advanced.map((field) => (
                <PropertyFieldRow
                  key={field.key}
                  field={field}
                  value={(node as Record<string, unknown>)[field.key]}
                  bindPaths={bindPaths}
                  parentPath={path}
                  store={store}
                  onChange={(value) => onChange(field.key, value)}
                />
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

interface PropertyFieldRowProps {
  field: PropertyField;
  value: unknown;
  bindPaths: string[];
  parentPath: NodePath;
  store: BuilderStore;
  onChange: (next: unknown) => void;
  /** Selected node — used by ActionEditor to read sibling fields (command, validate). */
  node?: BuilderNode;
  /** Sibling-field writer — used by ActionEditor to update command/validate
   *  on the same node when a domain dispatch URN is chosen. */
  onSiblingChange?: (key: string, next: unknown) => void;
}

function PropertyFieldRow({ field, value, bindPaths, parentPath, store, onChange, node, onSiblingChange }: PropertyFieldRowProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-1 text-[11px] font-medium text-foreground">
        {field.label}
        {field.required ? <span className="text-[var(--vscode-errorForeground)]">*</span> : null}
      </label>
      <PropertyFieldInput
        field={field}
        value={value}
        onChange={onChange}
        bindPaths={bindPaths}
        parentPath={parentPath}
        store={store}
        node={node}
        onSiblingChange={onSiblingChange}
      />
      {field.hint ? (
        <span className="text-[10px] text-muted-text">{field.hint}</span>
      ) : null}
    </div>
  );
}

function PropertyFieldInput({ field, value, onChange, bindPaths, parentPath, store, node, onSiblingChange }: PropertyFieldRowProps) {
  switch (field.kind) {
    case 'text':
      return (
        <Input
          size="sm"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      );
    case 'number':
      return (
        <Input
          size="sm"
          type="number"
          value={typeof value === 'number' ? value : value === undefined ? '' : Number(value) || ''}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') onChange(undefined);
            else onChange(Number(raw));
          }}
          min={field.min}
          max={field.max}
          step={field.step}
        />
      );
    case 'select':
      return (
        <Select
          className="h-8 text-xs"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || undefined)}
        >
          {field.allowEmpty ? <option value="">—</option> : null}
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      );
    case 'bind':
      return (
        <BindAutocomplete
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
          paths={bindPaths}
          placeholder={field.placeholder}
        />
      );
    case 'action':
      return (
        <ActionEditor
          value={value}
          onChange={onChange}
          multi={field.multi}
          nodeType={typeof (node as Record<string, unknown> | undefined)?.type === 'string' ? (node as { type: string }).type : undefined}
          command={(node as Record<string, unknown> | undefined)?.command}
          validate={(node as Record<string, unknown> | undefined)?.validate}
          onSiblingChange={onSiblingChange}
        />
      );
    case 'icon':
      // The per-component icon set (PrimeIcons vs Material Icons) is conveyed
      // through `field.hint` set on the catalog entry; placeholder stays generic.
      return (
        <Input
          size="sm"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          placeholder="icon name (e.g. info, search, check)"
        />
      );
    case 'multilang':
      return <MultiLangInput value={value} onChange={onChange} multiline={field.multiline} placeholder={field.placeholder} />;
    case 'boolean':
      return (
        <label className="flex items-center gap-2 text-[12px] text-foreground">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked || undefined)}
          />
          {value ? 'On' : 'Off'}
        </label>
      );
    case 'tabs':
      return <TabsField value={value} onChange={onChange} />;
    case 'steps':
      return <StepsField value={value} onChange={onChange} />;
    case 'node-slot':
      return (
        <NodeSlotField
          parentPath={parentPath}
          slotKey={field.key}
          multi={field.multi ?? false}
          acceptTypes={field.acceptTypes}
          store={store}
        />
      );
    case 'spans':
      return <SpansField value={value} onChange={onChange} />;
    case 'raw':
      return <RawJsonField value={value} onChange={onChange} />;
    default: {
      const _exhaustive: never = field;
      void _exhaustive;
      return null;
    }
  }
}


function RawJsonField({ value, onChange }: { value: unknown; onChange: (next: unknown) => void }) {
  const text = useMemo(() => {
    if (value === undefined) return '';
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return typeof value === 'string' ? value : '';
    }
  }, [value]);
  return (
    <JsonCodeField
      value={text}
      height={140}
      onChange={(next) => {
        const trimmed = next.trim();
        if (trimmed === '') {
          onChange(undefined);
          return;
        }
        try {
          onChange(JSON.parse(trimmed));
        } catch {
          // Keep raw — caller will see a string instead of undefined.
          onChange(next);
        }
      }}
      aria-label="JSON value"
    />
  );
}
