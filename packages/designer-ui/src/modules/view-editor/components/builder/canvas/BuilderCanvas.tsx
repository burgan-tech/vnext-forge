/**
 * Visual canvas for the pseudo-ui builder.
 *
 * R11: the SDK's `designer="edit"` mode now drives direct
 * manipulation on the canvas — click selection, hover outlines,
 * delete button, HTML5 native drag-drop (mid-tree positions). We
 * forward the SDK delegate to `useBuilderDesignerDelegate`, which
 * maps callbacks back into builder-store actions via the JSON-Pointer
 * ↔ NodePath converter.
 *
 * The earlier @dnd-kit `EmptyDropZone` / `RootDropZone` drop targets
 * were removed: the SDK accepts drops directly into the root view
 * container, so we no longer need parent-DOM-side droppables. The
 * outline panel keeps its own @dnd-kit reorder behaviour (separate
 * render tree, no conflict).
 *
 * Selection lives in the builder store as a `NodePath` array; the SDK
 * needs the equivalent JSON Pointer string via `selectedNodePath`. We
 * compute it once per selection change.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useStore } from 'zustand';

import { PseudoUiViewSurface } from '../../../../quick-run/pseudo-ui/PseudoUiViewSurface';
import type { ViewResponse } from '../../../../quick-run/types/quickrun.types';
import type { SchemaResolver } from '../../../../quick-run/pseudo-ui/createDataSchemaResolver';
import { ViewRenderer } from '@vnext-forge-studio/vnext-types';
import { findComponentMeta } from '../palette/componentCatalog';
import { useBuilderDesignerDelegate } from '../state/useBuilderDesignerDelegate';
import { jsonPointerToNodePath, nodePathToJsonPointer } from '../utils/jsonPointerPath';
import { getNode } from '../utils/nodeOps';
import { type BuilderDefinition, type NodePath } from '../types';
import { type BuilderStore } from '../state/builderStore';
import { useDragAutoScroll } from './useDragAutoScroll';

export interface BuilderCanvasProps {
  store: BuilderStore;
  viewKey: string;
  onEditAsJson: () => void;
  /** Whether the inspector panel is currently open. Drives the
   *  chevron icon direction in the canvas header. */
  inspectorOpen: boolean;
  /** Toggle the inspector panel from the canvas header chevron. */
  onToggleInspector: () => void;
  /** R13: opens the shared context menu owned by the builder shell.
   *  Triggered by right-clicking on any SDK-rendered node inside the
   *  designer shadow tree (resolved via `data-pseudo-path` on
   *  `event.composedPath()`). */
  onOpenContextMenu?: (path: NodePath, x: number, y: number) => void;
  /** R16.1: resolves a dataSchema URN to the JSON-schema object so
   *  the SDK render can reason about ForEach / Component / conditional
   *  / bind property metadata. Forwarded straight to the surface. */
  resolveSchema?: SchemaResolver;
}

export function BuilderCanvas({
  store,
  viewKey,
  onEditAsJson,
  inspectorOpen,
  onToggleInspector,
  onOpenContextMenu,
  resolveSchema,
}: BuilderCanvasProps) {
  const definition = useStore(store, (s) => s.definition);
  const selectedPath = useStore(store, (s) => s.selectedPath);

  // R15: hover-driven live breadcrumb. Local to the canvas — we don't
  // want hover to leak into the store and re-render unrelated
  // subscribers (inspector, outline) on every mouse move.
  const [hoveredPath, setHoveredPath] = useState<NodePath | null>(null);
  const handleHover = useCallback((path: NodePath | null) => setHoveredPath(path), []);
  const delegate = useBuilderDesignerDelegate(store, { onHover: handleHover });

  // Effective path the header should describe: live hover wins, then
  // selection, then nothing. The header flags hover-only mode so the
  // user knows the breadcrumb is a preview, not the current selection.
  const breadcrumbPath = hoveredPath ?? selectedPath;
  const breadcrumbIsHover = hoveredPath !== null;

  const previewResponse = useMemo<ViewResponse>(() => {
    return {
      key: viewKey || 'preview',
      content: definition as unknown as Record<string, unknown>,
      type: 'Json',
      renderer: String(ViewRenderer.PseudoUi),
    };
  }, [definition, viewKey]);

  const selectedPointer = useMemo(
    () => (selectedPath ? nodePathToJsonPointer(selectedPath) : undefined),
    [selectedPath],
  );

  // Build a human breadcrumb for the displayed path (hover preview if
  // active, otherwise the selection). We follow the path through the
  // live tree so each segment can show the node type rather than just
  // an index.
  const breadcrumb = useMemo(() => {
    if (!breadcrumbPath || breadcrumbPath.length === 0) return null;
    const crumbs: string[] = [];
    for (let i = 1; i <= breadcrumbPath.length; i++) {
      const partial = breadcrumbPath.slice(0, i);
      const node = getNode(definition.view, partial);
      if (!node) break;
      const segment = breadcrumbPath[i - 1];
      const meta = findComponentMeta(node.type);
      const label = meta?.label ?? node.type;
      crumbs.push(typeof segment === 'string' ? `${label} (${segment})` : label);
    }
    return crumbs;
  }, [definition.view, breadcrumbPath]);

  const hasRootChildren = ((definition.view.children as unknown[] | undefined) ?? []).length > 0;

  const autoScroll = useDragAutoScroll();

  // R13: right-click on the canvas → resolve the closest
  // `[data-pseudo-path]` ancestor (which the SDK marks on every
  // designer-mode node wrapper) and open the shared context menu.
  // `composedPath()` exposes the path *through* the shadow root, so we
  // can target shadow-tree nodes from a parent-DOM event listener.
  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (!onOpenContextMenu) return;
    const composed = typeof e.nativeEvent.composedPath === 'function' ? e.nativeEvent.composedPath() : [];
    for (const target of composed) {
      if (!(target instanceof HTMLElement)) continue;
      const pointer = target.dataset.pseudoPath;
      if (typeof pointer === 'string' && pointer.length > 0) {
        const nodePath = jsonPointerToNodePath(pointer);
        if (!nodePath) return;
        e.preventDefault();
        e.stopPropagation();
        onOpenContextMenu(nodePath, e.clientX, e.clientY);
        return;
      }
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-primary-surface">
      <CanvasHeader
        breadcrumb={breadcrumb}
        isHover={breadcrumbIsHover}
        onEditAsJson={onEditAsJson}
        inspectorOpen={inspectorOpen}
        onToggleInspector={onToggleInspector}
      />
      <div
        ref={autoScroll.ref}
        onDragOver={autoScroll.onDragOver}
        onDragLeave={autoScroll.onDragLeave}
        onDragEnd={autoScroll.onDragEnd}
        onDrop={autoScroll.onDrop}
        onContextMenu={handleContextMenu}
        className="min-h-0 flex-1 overflow-y-auto p-3"
      >
        {hasRootChildren ? null : <EmptyCanvasHint />}
        <PseudoUiViewSurface
          viewResponse={previewResponse}
          mode="preview"
          designer="edit"
          selectedNodePath={selectedPointer}
          delegate={delegate}
          ariaLabel="Builder canvas"
          fillHeight={false}
          errorActions={[{ label: 'Edit as JSON', onTrigger: onEditAsJson }]}
          resolveSchema={resolveSchema}
        />
      </div>
    </div>
  );
}

function CanvasHeader({
  breadcrumb,
  isHover,
  onEditAsJson,
  inspectorOpen,
  onToggleInspector,
}: {
  breadcrumb: string[] | null;
  /** R15: true while the breadcrumb describes a hovered (not selected)
   *  node — rendered italic + dimmed so the user can tell preview
   *  from the actual selection. */
  isHover: boolean;
  onEditAsJson: () => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-primary-border bg-primary-surface px-3 py-1.5">
      <div className="flex min-w-0 items-center gap-2 text-[11px]">
        <span className="shrink-0 rounded bg-primary-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary-text">
          Canvas
        </span>
        {breadcrumb && breadcrumb.length > 0 ? (
          <span
            className={[
              'min-w-0 truncate',
              isHover
                ? 'italic text-muted-text'
                : 'text-foreground',
            ].join(' ')}
            title={breadcrumb.join(' › ')}
            aria-live="polite"
          >
            {breadcrumb.map((crumb, i) => (
              <span key={`${crumb}-${i}`}>
                {i > 0 ? <span className="mx-1 text-muted-text">›</span> : null}
                <span className={i === breadcrumb.length - 1 && !isHover ? 'font-semibold' : ''}>{crumb}</span>
              </span>
            ))}
          </span>
        ) : (
          <span className="text-muted-text">Nothing selected</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          className="rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-button-secondaryBackground)] px-2 py-0.5 text-[10px] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-list-hoverBackground)]"
          onClick={onEditAsJson}
        >
          Edit as JSON
        </button>
        <button
          type="button"
          aria-label={inspectorOpen ? 'Hide inspector' : 'Show inspector'}
          title={inspectorOpen ? 'Hide inspector' : 'Show inspector'}
          onClick={onToggleInspector}
          className="flex h-6 w-6 items-center justify-center rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-list-hoverBackground)]"
        >
          {inspectorOpen ? <ChevronRight size={12} aria-hidden /> : <ChevronLeft size={12} aria-hidden />}
        </button>
      </div>
    </div>
  );
}

function EmptyCanvasHint() {
  return (
    <div className="mb-2 flex min-h-[80px] items-center justify-center rounded border-2 border-dashed border-[var(--vscode-panel-border)] px-4 py-4 text-center text-[12px] text-muted-text">
      <div>
        <div className="text-foreground">Drag a component here to begin</div>
        <div className="mt-1 text-[10px]">
          Switch to "Components" in the left tab to pick from layout, inputs, buttons, and more.
        </div>
      </div>
    </div>
  );
}

/** Used in the shell to give the user a passable reference type. */
export type BuilderCanvasUsedDefinition = BuilderDefinition;
