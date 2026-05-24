/**
 * R16.2-B: editor for componentNode slot properties.
 *
 * Vocabulary declares several non-`children` slots that hold nested
 * `componentNode`s: ListTile.leading/trailing, AppBar.leading,
 * AppBar.actions (array), Dialog.actions (array), NavigationDrawer.header,
 * Menu.anchor, Badge.children (exactly one node), and Carousel.template.
 * Each slot accepts a fresh node from a curated palette subset; the
 * inspector renders a picker + summary card so the user can pick the
 * type without leaving the inspector, then click into the slot to
 * edit its props in the same panel.
 *
 * The slot's stored shape — single node vs `BuilderNode[]` — is driven
 * by the `multi` prop. We mutate the parent node's slot value via
 * `updateNodeProp`, then `selectNode` so the inspector immediately
 * follows the user into the nested context (and the outline tree's
 * R14.2 generic string-segment walking renders the slot row).
 */

import { useMemo, useState } from 'react';
import { ArrowLeftRight, MoveDown, MoveUp, Plus, Trash2 } from 'lucide-react';
import { useStore } from 'zustand';

import { Select } from '../../../../../ui/Select';
import { type BuilderStore } from '../state/builderStore';
import { type BuilderNode, type NodePath } from '../types';
import { COMPONENT_CATALOG, createNodeFromCatalog, findComponentMeta } from '../palette/componentCatalog';
import { getNode } from '../utils/nodeOps';

export interface NodeSlotFieldProps {
  store: BuilderStore;
  /** Path of the node that *owns* the slot (the parent). */
  parentPath: NodePath;
  /** Property key the slot lives at, e.g. `'leading'`, `'actions'`. */
  slotKey: string;
  /** When true the slot value is `BuilderNode[]`; otherwise single node. */
  multi: boolean;
  /** Optional whitelist of component types the picker exposes. */
  acceptTypes?: readonly string[];
}

export function NodeSlotField({
  store,
  parentPath,
  slotKey,
  multi,
  acceptTypes,
}: NodeSlotFieldProps) {
  const definition = useStore(store, (s) => s.definition);
  const updateNodeProp = useStore(store, (s) => s.updateNodeProp);
  const selectNode = useStore(store, (s) => s.selectNode);

  const parent = useMemo(() => getNode(definition.view, parentPath), [definition.view, parentPath]);
  const slotValue = parent ? (parent as Record<string, unknown>)[slotKey] : undefined;

  const pickableTypes = useMemo(() => {
    const types = acceptTypes && acceptTypes.length > 0
      ? acceptTypes
      : COMPONENT_CATALOG.map((c) => c.type);
    return types.filter((t) => findComponentMeta(t) !== undefined);
  }, [acceptTypes]);

  if (!parent) return null;

  if (multi) {
    const list: BuilderNode[] = Array.isArray(slotValue) ? (slotValue as BuilderNode[]) : [];
    return (
      <MultiSlotEditor
        list={list}
        pickableTypes={pickableTypes}
        onChange={(next) => updateNodeProp(parentPath, slotKey, next.length === 0 ? undefined : next)}
        onPick={(path) => selectNode(path)}
        parentPath={parentPath}
        slotKey={slotKey}
      />
    );
  }

  const single: BuilderNode | undefined = slotValue && typeof slotValue === 'object' && !Array.isArray(slotValue)
    ? (slotValue as BuilderNode)
    : undefined;

  return (
    <SingleSlotEditor
      node={single}
      pickableTypes={pickableTypes}
      onCreate={(type) => {
        const fresh = createNodeFromCatalog(type);
        if (!fresh) return;
        updateNodeProp(parentPath, slotKey, fresh);
        // Auto-focus the new node so its own props become editable.
        selectNode([...parentPath, slotKey]);
      }}
      onChange={(next) => updateNodeProp(parentPath, slotKey, next)}
      onSelect={() => selectNode([...parentPath, slotKey])}
      onRemove={() => updateNodeProp(parentPath, slotKey, undefined)}
    />
  );
}

interface SingleSlotEditorProps {
  node: BuilderNode | undefined;
  pickableTypes: readonly string[];
  onCreate: (type: string) => void;
  onChange: (next: BuilderNode) => void;
  onSelect: () => void;
  onRemove: () => void;
}

function SingleSlotEditor({ node, pickableTypes, onCreate, onSelect, onRemove }: SingleSlotEditorProps) {
  const [pickType, setPickType] = useState<string>('');

  if (!node) {
    return (
      <div className="flex items-center gap-1">
        <Select
          className="h-8 text-xs"
          value={pickType}
          onChange={(e) => setPickType(e.target.value)}
          aria-label="Pick component type"
        >
          <option value="">— pick a component —</option>
          {pickableTypes.map((t) => {
            const meta = findComponentMeta(t);
            return (
              <option key={t} value={t}>
                {meta?.label ?? t}
              </option>
            );
          })}
        </Select>
        <button
          type="button"
          disabled={!pickType}
          onClick={() => {
            if (!pickType) return;
            onCreate(pickType);
            setPickType('');
          }}
          className="flex h-8 items-center gap-1 rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-button-background)] px-2 text-[11px] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={11} /> Add
        </button>
      </div>
    );
  }

  const meta = findComponentMeta(node.type);
  return (
    <div className="flex items-center justify-between gap-1 rounded border border-primary-border bg-primary px-2 py-1">
      <button
        type="button"
        onClick={onSelect}
        className="flex flex-1 items-center gap-1.5 text-left text-[11px] text-foreground hover:underline"
        aria-label={`Open ${meta?.label ?? node.type} in inspector`}
      >
        <ArrowLeftRight size={11} className="shrink-0 text-muted-text" />
        <span className="font-medium">{meta?.label ?? node.type}</span>
      </button>
      <button
        type="button"
        aria-label="Remove from slot"
        onClick={onRemove}
        className="rounded p-1 text-muted-text hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-errorForeground)]"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}

interface MultiSlotEditorProps {
  list: BuilderNode[];
  pickableTypes: readonly string[];
  onChange: (next: BuilderNode[]) => void;
  onPick: (path: NodePath) => void;
  parentPath: NodePath;
  slotKey: string;
}

function MultiSlotEditor({
  list,
  pickableTypes,
  onChange,
  onPick,
  parentPath,
  slotKey,
}: MultiSlotEditorProps) {
  const [pickType, setPickType] = useState<string>('');

  const removeAt = (index: number): void => {
    const next = list.slice();
    next.splice(index, 1);
    onChange(next);
  };
  const moveUp = (index: number): void => {
    if (index <= 0) return;
    const next = list.slice();
    [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
    onChange(next);
  };
  const moveDown = (index: number): void => {
    if (index >= list.length - 1) return;
    const next = list.slice();
    [next[index + 1], next[index]] = [next[index]!, next[index + 1]!];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {list.length === 0 ? (
        <p className="text-[10px] text-muted-text">No items.</p>
      ) : (
        list.map((node, i) => {
          const meta = findComponentMeta(node.type);
          return (
            <div
              key={i}
              className="flex items-center justify-between gap-1 rounded border border-primary-border bg-primary px-2 py-1"
            >
              <button
                type="button"
                onClick={() => onPick([...parentPath, slotKey, i])}
                className="flex flex-1 items-center gap-1.5 text-left text-[11px] text-foreground hover:underline"
                aria-label={`Open ${meta?.label ?? node.type} at index ${i}`}
              >
                <span className="text-[10px] text-muted-text">{i + 1}.</span>
                <span className="font-medium">{meta?.label ?? node.type}</span>
              </button>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => moveUp(i)}
                  className="rounded p-1 text-muted-text hover:bg-[var(--vscode-list-hoverBackground)] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <MoveUp size={11} />
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={i === list.length - 1}
                  onClick={() => moveDown(i)}
                  className="rounded p-1 text-muted-text hover:bg-[var(--vscode-list-hoverBackground)] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <MoveDown size={11} />
                </button>
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => removeAt(i)}
                  className="rounded p-1 text-muted-text hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-errorForeground)]"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          );
        })
      )}
      <div className="flex items-center gap-1">
        <Select
          className="h-8 text-xs"
          value={pickType}
          onChange={(e) => setPickType(e.target.value)}
          aria-label="Pick component type to add"
        >
          <option value="">— pick a component —</option>
          {pickableTypes.map((t) => {
            const meta = findComponentMeta(t);
            return (
              <option key={t} value={t}>
                {meta?.label ?? t}
              </option>
            );
          })}
        </Select>
        <button
          type="button"
          disabled={!pickType}
          onClick={() => {
            if (!pickType) return;
            const fresh = createNodeFromCatalog(pickType);
            if (!fresh) return;
            const nextIndex = list.length;
            onChange([...list, fresh]);
            // Auto-focus the new node so its own props become editable.
            onPick([...parentPath, slotKey, nextIndex]);
            setPickType('');
          }}
          className="flex h-8 items-center gap-1 rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-button-background)] px-2 text-[11px] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={11} /> Add
        </button>
      </div>
    </div>
  );
}
