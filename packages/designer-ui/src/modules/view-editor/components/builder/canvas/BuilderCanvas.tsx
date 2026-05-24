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
import { useMemo } from 'react';
import { useStore } from 'zustand';

import { PseudoUiViewSurface } from '../../../../quick-run/pseudo-ui/PseudoUiViewSurface';
import type { ViewResponse } from '../../../../quick-run/types/quickrun.types';
import { ViewRenderer } from '@vnext-forge-studio/vnext-types';
import { findComponentMeta } from '../palette/componentCatalog';
import { useBuilderDesignerDelegate } from '../state/useBuilderDesignerDelegate';
import { nodePathToJsonPointer } from '../utils/jsonPointerPath';
import { getNode } from '../utils/nodeOps';
import { type BuilderDefinition } from '../types';
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
}

export function BuilderCanvas({
  store,
  viewKey,
  onEditAsJson,
  inspectorOpen,
  onToggleInspector,
}: BuilderCanvasProps) {
  const definition = useStore(store, (s) => s.definition);
  const selectedPath = useStore(store, (s) => s.selectedPath);
  const delegate = useBuilderDesignerDelegate(store);

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

  // Build a human breadcrumb for the selected node. We follow the path
  // through the live tree so each segment can show the node type rather
  // than just an index.
  const breadcrumb = useMemo(() => {
    if (!selectedPath || selectedPath.length === 0) return null;
    const crumbs: string[] = [];
    for (let i = 1; i <= selectedPath.length; i++) {
      const partial = selectedPath.slice(0, i);
      const node = getNode(definition.view, partial);
      if (!node) break;
      const segment = selectedPath[i - 1];
      const meta = findComponentMeta(node.type);
      const label = meta?.label ?? node.type;
      crumbs.push(typeof segment === 'string' ? `${label} (${segment})` : label);
    }
    return crumbs;
  }, [definition.view, selectedPath]);

  const hasRootChildren = ((definition.view.children as unknown[] | undefined) ?? []).length > 0;

  const autoScroll = useDragAutoScroll();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <CanvasHeader
        breadcrumb={breadcrumb}
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
        />
      </div>
    </div>
  );
}

function CanvasHeader({
  breadcrumb,
  onEditAsJson,
  inspectorOpen,
  onToggleInspector,
}: {
  breadcrumb: string[] | null;
  onEditAsJson: () => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] px-3 py-1.5">
      <div className="flex min-w-0 items-center gap-2 text-[11px]">
        <span className="shrink-0 rounded bg-[var(--vscode-badge-background,var(--vscode-list-activeSelectionBackground))] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--vscode-badge-foreground,var(--vscode-foreground))]">
          Canvas
        </span>
        {breadcrumb && breadcrumb.length > 0 ? (
          <span className="truncate text-[var(--vscode-foreground)]" title={breadcrumb.join(' › ')}>
            {breadcrumb.map((crumb, i) => (
              <span key={`${crumb}-${i}`}>
                {i > 0 ? <span className="mx-1 text-[var(--vscode-descriptionForeground)]">›</span> : null}
                <span className={i === breadcrumb.length - 1 ? 'font-semibold' : ''}>{crumb}</span>
              </span>
            ))}
          </span>
        ) : (
          <span className="text-[var(--vscode-descriptionForeground)]">Nothing selected</span>
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
    <div className="mb-2 flex min-h-[80px] items-center justify-center rounded border-2 border-dashed border-[var(--vscode-panel-border)] px-4 py-4 text-center text-[12px] text-[var(--vscode-descriptionForeground)]">
      <div>
        <div className="text-[var(--vscode-foreground)]">Drag a component here to begin</div>
        <div className="mt-1 text-[10px]">
          Switch to "Components" in the left tab to pick from layout, inputs, buttons, and more.
        </div>
      </div>
    </div>
  );
}

/** Used in the shell to give the user a passable reference type. */
export type BuilderCanvasUsedDefinition = BuilderDefinition;
