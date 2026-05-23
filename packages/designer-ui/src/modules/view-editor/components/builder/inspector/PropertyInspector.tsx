/**
 * Property inspector — generates a typed form for the currently selected
 * node from its `componentCatalog.propertySchema`.
 *
 * When nothing is selected, the inspector shows the view-level settings
 * panel (dataSchema picker, lookups, uiState) instead.
 */

import { Plus, Trash2 } from 'lucide-react';
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
      />
    );
  }

  const node = getNode(definition.view, selectedPath);
  if (!node) {
    return (
      <div className="p-3 text-[11px] text-[var(--vscode-descriptionForeground)]">
        Selected node not found. Pick another from the outline.
      </div>
    );
  }

  const meta = findComponentMeta(node.type);
  if (!meta) {
    return (
      <div className="p-3">
        <p className="mb-2 text-[12px] text-[var(--vscode-foreground)]">
          Unknown component type: <code>{node.type}</code>
        </p>
        <p className="text-[11px] text-[var(--vscode-descriptionForeground)]">
          Edit this node as raw JSON.
        </p>
      </div>
    );
  }

  const showAdvancedFields = meta.propertySchema.some((f) => f.advanced);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-[var(--vscode-panel-border)] p-3">
        <div className="mb-1 text-[10px] uppercase tracking-wide text-[var(--vscode-descriptionForeground)]">
          {meta.category}
        </div>
        <h3 className="text-[13px] font-semibold text-[var(--vscode-foreground)]">{meta.label}</h3>
        {meta.description ? (
          <p className="mt-1 text-[11px] text-[var(--vscode-descriptionForeground)]">{meta.description}</p>
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
  bindPaths: string[];
  showAdvanced: boolean;
  onChange: (key: string, value: unknown) => void;
}

function PropertySchemaForm({ node, schema, bindPaths, showAdvanced, onChange }: PropertySchemaFormProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const visible = schema.filter((f) => !f.advanced);
  const advanced = schema.filter((f) => f.advanced);

  return (
    <div className="flex flex-col gap-3">
      {visible.length === 0 && advanced.length === 0 ? (
        <p className="text-[11px] text-[var(--vscode-descriptionForeground)]">
          This component has no editable properties.
        </p>
      ) : null}
      {visible.map((field) => (
        <PropertyFieldRow
          key={field.key}
          field={field}
          value={(node as Record<string, unknown>)[field.key]}
          bindPaths={bindPaths}
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
  onChange: (next: unknown) => void;
}

function PropertyFieldRow({ field, value, bindPaths, onChange }: PropertyFieldRowProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-1 text-[11px] font-medium text-[var(--vscode-foreground)]">
        {field.label}
        {field.required ? <span className="text-[var(--vscode-errorForeground)]">*</span> : null}
      </label>
      <PropertyFieldInput field={field} value={value} onChange={onChange} bindPaths={bindPaths} />
      {field.hint ? (
        <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">{field.hint}</span>
      ) : null}
    </div>
  );
}

function PropertyFieldInput({ field, value, onChange, bindPaths }: PropertyFieldRowProps) {
  switch (field.kind) {
    case 'text':
      return (
        <Input
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      );
    case 'number':
      return (
        <Input
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
      return <ActionEditor value={value} onChange={onChange} multi={field.multi} />;
    case 'icon':
      // The per-component icon set (PrimeIcons vs Material Icons) is conveyed
      // through `field.hint` set on the catalog entry; placeholder stays generic.
      return (
        <Input
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          placeholder="icon name (e.g. info, search, check)"
        />
      );
    case 'multilang':
      return <MultiLangInput value={value} onChange={onChange} multiline={field.multiline} placeholder={field.placeholder} />;
    case 'boolean':
      return (
        <label className="flex items-center gap-2 text-[12px] text-[var(--vscode-foreground)]">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked || undefined)}
          />
          {value ? 'On' : 'Off'}
        </label>
      );
    case 'tabs':
      return <TabsRawField value={value} onChange={onChange} />;
    case 'raw':
      return <RawJsonField value={value} onChange={onChange} />;
    default: {
      const _exhaustive: never = field;
      void _exhaustive;
      return null;
    }
  }
}

function MultiLangInput({
  value,
  onChange,
  multiline,
  placeholder,
}: {
  value: unknown;
  onChange: (next: unknown) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  // Allow either a plain string or `{ en, tr, ... }`.
  const isString = typeof value === 'string';
  const obj = typeof value === 'object' && value !== null ? (value as Record<string, string>) : {};
  const [mode, setMode] = useState<'object' | 'string'>(isString ? 'string' : 'object');

  if (mode === 'string') {
    return (
      <div className="flex flex-col gap-1">
        {multiline ? (
          <Textarea
            value={isString ? (value) : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={3}
          />
        ) : (
          <Input
            value={isString ? (value) : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
          />
        )}
        <button
          type="button"
          className="self-start text-[10px] text-[var(--vscode-textLink-foreground)] hover:underline"
          onClick={() => {
            setMode('object');
            onChange({ en: isString ? value : '' });
          }}
        >
          Switch to multi-language
        </button>
      </div>
    );
  }

  // Show every key already present, in insertion order; if a brand-new
  // multi-lang field has none, default to a single empty 'en' row so the
  // user has somewhere to start typing.
  const existingKeys = Object.keys(obj);
  const langs = existingKeys.length > 0 ? existingKeys : ['en'];

  /** Validate against the SDK vocabulary regex: ISO 639-1 + optional region. */
  const isValidLangCode = (code: string): boolean => /^[a-z]{2}(-[A-Z]{2})?$/.test(code);

  const renameKey = (oldKey: string, newKey: string) => {
    if (newKey === oldKey) return;
    if (newKey === '' || newKey === oldKey || Object.prototype.hasOwnProperty.call(obj, newKey)) return;
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      next[k === oldKey ? newKey : k] = v;
    }
    onChange(next);
  };

  const removeKey = (key: string) => {
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k !== key) next[k] = v;
    }
    onChange(next);
  };

  const addKey = () => {
    // Suggest next likely language code.
    const used = new Set(existingKeys);
    const candidates = ['tr', 'en', 'ar', 'de', 'fr', 'es'];
    const next = candidates.find((c) => !used.has(c)) ?? '';
    if (next === '') return; // user can edit the code via the input
    onChange({ ...obj, [next]: '' });
  };

  return (
    <div className="flex flex-col gap-1.5">
      {langs.map((lang) => {
        const valid = lang === '' || isValidLangCode(lang);
        return (
          <div
            key={lang}
            className="flex flex-col gap-1 rounded border border-[var(--vscode-panel-border)] p-1.5"
          >
            {/* Header row — compact lang code on the left, remove on the right. */}
            <div className="flex items-center justify-between gap-2">
              <Input
                value={lang}
                onChange={(e) =>
                  renameKey(
                    lang,
                    e.target.value.trim().toLowerCase().replace(/[^a-z-]/g, ''),
                  )
                }
                aria-label="Language code"
                spellCheck={false}
                className={[
                  'h-6 w-[64px] px-1.5 text-[10px] uppercase tracking-wide',
                  !valid ? 'border-[var(--vscode-inputValidation-warningBorder)]' : '',
                ].join(' ')}
                title={!valid ? 'Expected ISO 639-1 code, e.g. en, tr, en-US' : undefined}
              />
              <button
                type="button"
                aria-label={`Remove ${lang} translation`}
                className="rounded p-1 text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-foreground)] disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => removeKey(lang)}
                disabled={langs.length <= 1}
              >
                <Trash2 size={11} />
              </button>
            </div>
            {/* Value row — full width. */}
            {multiline ? (
              <Textarea
                value={obj[lang] ?? ''}
                onChange={(e) => onChange({ ...obj, [lang]: e.target.value })}
                placeholder={placeholder}
                rows={2}
              />
            ) : (
              <Input
                value={obj[lang] ?? ''}
                onChange={(e) => onChange({ ...obj, [lang]: e.target.value })}
                placeholder={placeholder}
              />
            )}
          </div>
        );
      })}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex items-center gap-1 self-start rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-button-secondaryBackground)] px-2 py-0.5 text-[10px] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-list-hoverBackground)]"
          onClick={addKey}
        >
          <Plus size={10} /> Add language
        </button>
        <button
          type="button"
          className="text-[10px] text-[var(--vscode-textLink-foreground)] hover:underline"
          onClick={() => {
            setMode('string');
            onChange(obj.en ?? '');
          }}
        >
          Switch to plain text
        </button>
      </div>
    </div>
  );
}

function TabsRawField({ value, onChange }: { value: unknown; onChange: (next: unknown) => void }) {
  // For now, edit the tabs array as JSON. A richer editor can replace this
  // later (renaming tabs, reordering) — captured as a SDK-side concern.
  return <RawJsonField value={value} onChange={onChange} />;
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
