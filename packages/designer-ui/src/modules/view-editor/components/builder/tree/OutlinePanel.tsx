/**
 * Outline panel — hierarchical tree view of the current builder definition.
 *
 * Primary structural editing surface: every tree row is a `@dnd-kit`
 * droppable + the row itself is the click target for selection. Drop hits
 * land between siblings or into containers via dedicated indicator slots.
 *
 * We intentionally keep the outline visually independent from the live
 * canvas — they share state via the store but each is rendered with its
 * own component tree so drag/drop hit testing stays predictable.
 */

import { useDraggable, useDroppable } from '@dnd-kit/core';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';

import { Input } from '../../../../../ui/Input';
import { findComponentMeta } from '../palette/componentCatalog';
import { type BuilderStore } from '../state/builderStore';
import { type BuilderNode, type NodePath } from '../types';

export interface OutlinePanelProps {
  store: BuilderStore;
  /** R13: right-click on any row opens the shared context menu hosted
   *  by the builder shell. The handler also selects the target node. */
  onOpenContextMenu?: (path: NodePath, x: number, y: number) => void;
}

function arraysEqual(a: NodePath | null, b: NodePath | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** Default-collapse anything at depth > this threshold so long trees stay scannable. */
const DEFAULT_COLLAPSE_DEPTH = 2;

export function OutlinePanel({ store, onOpenContextMenu }: OutlinePanelProps) {
  const definition = useStore(store, (s) => s.definition);
  const selectedPath = useStore(store, (s) => s.selectedPath);
  const selectNode = useStore(store, (s) => s.selectNode);

  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();

  // Build the set of paths whose subtree contains a match (so we can keep
  // them visible while filtering). Empty query → no filter.
  const matchingPaths = useMemo(() => {
    if (normalizedQuery === '') return null;
    const matches = new Set<string>();
    walkAll(definition.view, [], (node, path) => {
      if (nodeMatchesQuery(node, normalizedQuery)) {
        // Add every ancestor path so the tree stays visible.
        for (let i = 0; i <= path.length; i++) {
          matches.add(path.slice(0, i).join('.'));
        }
      }
    });
    return matches;
  }, [definition.view, normalizedQuery]);

  // Paths along the selection chain (root → selected node). Used to
  // auto-expand the outline so the selected row is visible without
  // overriding manual user toggles (see `OutlineRow`).
  const selectionAncestorPaths = useMemo(() => {
    if (!selectedPath || selectedPath.length === 0) return null;
    const set = new Set<string>();
    for (let i = 0; i <= selectedPath.length; i++) {
      set.add(selectedPath.slice(0, i).join('.'));
    }
    return set;
  }, [selectedPath]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-[var(--vscode-panel-border)] p-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search nodes (type, bind, label)..."
          aria-label="Search outline"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        <OutlineRow
          node={definition.view}
          path={[]}
          depth={0}
          selectedPath={selectedPath}
          onSelect={selectNode}
          onOpenContextMenu={onOpenContextMenu}
          matchingPaths={matchingPaths}
          selectionAncestorPaths={selectionAncestorPaths}
          query={normalizedQuery}
        />
      </div>
    </div>
  );
}

function walkAll(
  node: BuilderNode,
  path: NodePath,
  visit: (node: BuilderNode, path: NodePath) => void,
): void {
  visit(node, path);
  // Standard children
  const children = (node.children) ?? [];
  children.forEach((child, i) => walkAll(child, [...path, i], visit));
  // ForEach template
  if (node.type === 'ForEach') {
    const tpl = (node as unknown as { template?: BuilderNode }).template;
    if (tpl) walkAll(tpl, [...path, 'template'], visit);
  }
  // TabView tabs[*].content[*]
  if (node.type === 'TabView') {
    const tabs = ((node as unknown as { tabs?: { content?: BuilderNode[] }[] }).tabs) ?? [];
    tabs.forEach((tab, ti) => {
      (tab.content ?? []).forEach((c, ci) => {
        walkAll(c, [...path, 'tabs', ti, 'content', ci], visit);
      });
    });
  }
  // Stepper steps[*].content[*]
  if (node.type === 'Stepper') {
    const steps = ((node as unknown as { steps?: { content?: BuilderNode[] }[] }).steps) ?? [];
    steps.forEach((step, si) => {
      (step.content ?? []).forEach((c, ci) => {
        walkAll(c, [...path, 'steps', si, 'content', ci], visit);
      });
    });
  }
}

function nodeMatchesQuery(node: BuilderNode, q: string): boolean {
  if (node.type.toLowerCase().includes(q)) return true;
  const bind = (node as { bind?: unknown }).bind;
  if (typeof bind === 'string' && bind.toLowerCase().includes(q)) return true;
  const label = (node as { label?: unknown }).label;
  if (typeof label === 'string' && label.toLowerCase().includes(q)) return true;
  if (label && typeof label === 'object') {
    for (const v of Object.values(label as Record<string, string>)) {
      if (typeof v === 'string' && v.toLowerCase().includes(q)) return true;
    }
  }
  return false;
}

interface OutlineRowProps {
  node: BuilderNode;
  path: NodePath;
  depth: number;
  selectedPath: NodePath | null;
  onSelect: (path: NodePath | null) => void;
  onOpenContextMenu?: (path: NodePath, x: number, y: number) => void;
  matchingPaths: ReadonlySet<string> | null;
  /** Paths from root to (and including) the selected node. When the
   *  current row's path is in this set, the row is forced expanded so
   *  the user can see the selected descendant. User manual toggles
   *  still win via `userToggled`. */
  selectionAncestorPaths: ReadonlySet<string> | null;
  query: string;
}

function OutlineRow({
  node,
  path,
  depth,
  selectedPath,
  onSelect,
  onOpenContextMenu,
  matchingPaths,
  selectionAncestorPaths,
  query,
}: OutlineRowProps) {
  // IMPORTANT: All hooks must run on every render (Rules of Hooks). The
  // search-filter early return below changes between true/false as the user
  // types, so we must call useDraggable up-front before any conditional
  // bailout — otherwise React crashes with "Rendered fewer hooks than
  // expected".
  const [userToggled, setUserToggled] = useState(false);
  const [collapsedManual, setCollapsedManual] = useState(false);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const id = `outline-${path.join('.')}`;
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `${id}-drag`,
    data: { kind: 'outline-drag', sourcePath: path } as const,
    disabled: path.length === 0, // can't drag the root
  });

  const pathKey = path.join('.');
  // While searching, force-expand any ancestor of a match.
  const isAncestorOfMatch = matchingPaths?.has(pathKey) ?? false;
  const isMatchItself = query !== '' && nodeMatchesQuery(node, query);
  const filterActive = matchingPaths !== null;
  const filterHides = filterActive && !isAncestorOfMatch && !isMatchItself;
  const isSelectionAncestor = selectionAncestorPaths?.has(pathKey) ?? false;
  const defaultCollapsed = depth > DEFAULT_COLLAPSE_DEPTH && !filterActive && !isSelectionAncestor;
  const collapsed = userToggled ? collapsedManual : defaultCollapsed;

  const isSelected = arraysEqual(selectedPath, path);

  // When this row becomes the selected node, bring it into view. We do
  // this in a layout effect so the parent rows have a chance to expand
  // (the auto-expand above is reactive to the same `selectedPath`).
  useEffect(() => {
    if (isSelected && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [isSelected]);

  if (filterHides) return null;

  const meta = findComponentMeta(node.type);
  const childRenderables = collectChildren(node, path);

  const setRowRef = (el: HTMLDivElement | null) => {
    rowRef.current = el;
    setDragRef(el);
  };

  return (
    <div className="flex flex-col">
      {/* The row itself — selection click target + drag handle */}
      <div
        ref={setRowRef}
        {...attributes}
        {...listeners}
        role="treeitem"
        aria-selected={isSelected}
        className={[
          'group flex items-center gap-1 rounded px-1 py-0.5 text-[12px]',
          'cursor-pointer',
          isSelected
            ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'
            : 'text-[var(--vscode-foreground)] hover:bg-[var(--vscode-list-hoverBackground)]',
          isDragging ? 'opacity-40' : '',
        ].join(' ')}
        style={{ paddingLeft: 4 + depth * 12 }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(path);
        }}
        onContextMenu={(e) => {
          if (!onOpenContextMenu) return;
          e.preventDefault();
          e.stopPropagation();
          onOpenContextMenu(path, e.clientX, e.clientY);
        }}
      >
        {childRenderables.length > 0 ? (
          <button
            type="button"
            aria-label={collapsed ? 'Expand' : 'Collapse'}
            className="flex h-4 w-4 items-center justify-center rounded hover:bg-[var(--vscode-list-hoverBackground)]"
            onClick={(e) => {
              e.stopPropagation();
              setUserToggled(true);
              setCollapsedManual(!collapsed);
            }}
          >
            {collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
          </button>
        ) : (
          <span className="inline-block h-4 w-4" />
        )}
        <span className="font-medium">{meta?.label ?? node.type}</span>
        <span className="ml-1 truncate text-[10px] text-[var(--vscode-descriptionForeground)]">
          {summarize(node)}
        </span>
      </div>

      {/* "Drop into" slot (when this node accepts children & is empty) */}
      {!collapsed && meta?.acceptsChildren && childRenderables.length === 0 ? (
        <DropSlot parentPath={path} index={0} depth={depth + 1} label="Drop here" />
      ) : null}

      {/* Children */}
      {!collapsed && childRenderables.length > 0 ? (
        <div>
          <DropSlot parentPath={path} index={0} depth={depth + 1} compact />
          {childRenderables.map((child, i) => (
            <div key={`${child.label}-${i}`}>
              <OutlineRow
                node={child.node}
                path={child.path}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelect={onSelect}
                onOpenContextMenu={onOpenContextMenu}
                matchingPaths={matchingPaths}
                selectionAncestorPaths={selectionAncestorPaths}
                query={query}
              />
              <DropSlot parentPath={path} index={i + 1} depth={depth + 1} compact />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface ChildRenderable {
  node: BuilderNode;
  path: NodePath;
  label: string;
}

function collectChildren(node: BuilderNode, parentPath: NodePath): ChildRenderable[] {
  if (node.type === 'ForEach') {
    const tpl = (node as unknown as { template?: BuilderNode }).template;
    if (!tpl) return [];
    return [{ node: tpl, path: [...parentPath, 'template'] as NodePath, label: 'template' }];
  }
  if (node.type === 'TabView') {
    const tabs = ((node as unknown as { tabs?: { content?: BuilderNode[] }[] }).tabs) ?? [];
    const out: ChildRenderable[] = [];
    tabs.forEach((tab, ti) => {
      (tab.content ?? []).forEach((child, ci) => {
        out.push({
          node: child,
          path: [...parentPath, 'tabs', ti, 'content', ci] as NodePath,
          label: `tab ${ti + 1} child ${ci + 1}`,
        });
      });
    });
    return out;
  }
  if (node.type === 'Stepper') {
    const steps = ((node as unknown as { steps?: { content?: BuilderNode[] }[] }).steps) ?? [];
    const out: ChildRenderable[] = [];
    steps.forEach((step, si) => {
      (step.content ?? []).forEach((child, ci) => {
        out.push({
          node: child,
          path: [...parentPath, 'steps', si, 'content', ci] as NodePath,
          label: `step ${si + 1} child ${ci + 1}`,
        });
      });
    });
    return out;
  }
  const children = (node.children ?? []);
  return children.map((child, i) => ({
    node: child,
    path: [...parentPath, i] as NodePath,
    label: `${i}`,
  }));
}

interface DropSlotProps {
  parentPath: NodePath;
  index: number;
  depth: number;
  compact?: boolean;
  label?: string;
}

function DropSlot({ parentPath, index, depth, compact, label }: DropSlotProps) {
  const id = `outline-drop-${parentPath.join('.')}-${index}`;
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { kind: 'outline-drop', parentPath, index } as const,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ paddingLeft: 4 + depth * 12 }}
      className={[
        compact ? 'h-1.5' : 'my-1 rounded border border-dashed px-2 py-1 text-[10px]',
        isOver
          ? compact
            ? 'bg-[var(--vscode-focusBorder)]'
            : 'border-[var(--vscode-focusBorder)] bg-[var(--vscode-list-hoverBackground)] text-[var(--vscode-foreground)]'
          : compact
            ? ''
            : 'border-[var(--vscode-panel-border)] text-[var(--vscode-descriptionForeground)]',
      ].join(' ')}
    >
      {!compact ? (label ?? 'Drop here') : null}
    </div>
  );
}

function summarize(node: BuilderNode): string {
  const bind = (node as { bind?: unknown }).bind;
  if (typeof bind === 'string' && bind) return `· bind: ${bind}`;
  const label = (node as { label?: unknown }).label;
  if (typeof label === 'string' && label) return `· "${label}"`;
  if (label && typeof label === 'object') {
    const first = Object.values(label as Record<string, string>)[0];
    if (first) return `· "${first}"`;
  }
  const content = (node as { content?: unknown }).content;
  if (typeof content === 'string') return `· "${content.slice(0, 30)}"`;
  if (content && typeof content === 'object') {
    const first = Object.values(content as Record<string, string>)[0];
    if (first) return `· "${String(first).slice(0, 30)}"`;
  }
  return '';
}
