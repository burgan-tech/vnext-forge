/**
 * Visual canvas for the pseudo-ui builder.
 *
 * Renders the current definition through the shared `PseudoUiViewSurface`
 * so the user always sees an accurate preview (WYSIWYG). Structural editing
 * happens primarily in the `OutlinePanel` (sibling component) where each
 * tree row knows its `NodePath`.
 *
 * This component exposes a single root-level drop zone for the case where
 * the user drags a component from the palette directly onto an empty
 * canvas (or onto the bottom of an existing view). Mid-tree drops happen
 * through the outline.
 */

import { useDroppable } from '@dnd-kit/core';
import { useMemo } from 'react';
import { useStore } from 'zustand';

import { PseudoUiViewSurface } from '../../../../quick-run/pseudo-ui/PseudoUiViewSurface';
import type { ViewResponse } from '../../../../quick-run/types/quickrun.types';
import { ViewRenderer } from '@vnext-forge-studio/vnext-types';
import { findComponentMeta } from '../palette/componentCatalog';
import { getNode } from '../utils/nodeOps';
import { type BuilderDefinition } from '../types';
import { type BuilderStore } from '../state/builderStore';

export interface BuilderCanvasProps {
  store: BuilderStore;
  viewKey: string;
  onEditAsJson: () => void;
}

export function BuilderCanvas({ store, viewKey, onEditAsJson }: BuilderCanvasProps) {
  const definition = useStore(store, (s) => s.definition);
  const selectedPath = useStore(store, (s) => s.selectedPath);

  const previewResponse = useMemo<ViewResponse>(() => {
    return {
      key: viewKey || 'preview',
      content: definition as unknown as Record<string, unknown>,
      type: 'Json',
      renderer: String(ViewRenderer.PseudoUi),
    };
  }, [definition, viewKey]);

  const rootMeta = findComponentMeta(definition.view.type);
  const rootChildren = (definition.view.children as unknown[] | undefined) ?? [];
  const showsEmptyState = (!rootMeta?.acceptsChildren && rootChildren.length === 0)
    || (rootMeta?.acceptsChildren && rootChildren.length === 0);

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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <CanvasHeader breadcrumb={breadcrumb} onEditAsJson={onEditAsJson} />
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {showsEmptyState ? <EmptyDropZone /> : (
          <>
            <PseudoUiViewSurface
              viewResponse={previewResponse}
              mode="preview"
              ariaLabel="Builder canvas preview"
              fillHeight={false}
              errorActions={[{ label: 'Edit as JSON', onTrigger: onEditAsJson }]}
            />
            <RootDropZone />
          </>
        )}
      </div>
    </div>
  );
}

function CanvasHeader({
  breadcrumb,
  onEditAsJson,
}: {
  breadcrumb: string[] | null;
  onEditAsJson: () => void;
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
      <button
        type="button"
        className="shrink-0 rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-button-secondaryBackground)] px-2 py-0.5 text-[10px] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-list-hoverBackground)]"
        onClick={onEditAsJson}
      >
        Edit as JSON
      </button>
    </div>
  );
}

function EmptyDropZone() {
  const { setNodeRef, isOver } = useDroppable({
    id: 'canvas-root-empty',
    data: { kind: 'canvas-drop', parentPath: [] as readonly (number | string)[], index: 0 } as const,
  });
  return (
    <div
      ref={setNodeRef}
      className={[
        'flex min-h-[120px] items-center justify-center rounded border-2 border-dashed px-4 py-5 text-center text-[12px]',
        isOver
          ? 'border-[var(--vscode-focusBorder)] bg-[var(--vscode-list-hoverBackground)]'
          : 'border-[var(--vscode-panel-border)] text-[var(--vscode-descriptionForeground)]',
      ].join(' ')}
    >
      <div>
        <div className="text-[var(--vscode-foreground)]">Drag a component here to begin</div>
        <div className="mt-1 text-[10px]">Switch to "Components" in the left tab to pick from layout, inputs, buttons, and more.</div>
      </div>
    </div>
  );
}

function RootDropZone() {
  // A subtle drop strip beneath the rendered preview so users can append to
  // the root view without going through the outline.
  const { setNodeRef, isOver } = useDroppable({
    id: 'canvas-root-append',
    data: {
      kind: 'canvas-drop',
      parentPath: [] as readonly (number | string)[],
      index: Number.MAX_SAFE_INTEGER,
    } as const,
  });
  return (
    <div
      ref={setNodeRef}
      className={[
        'mt-3 rounded border border-dashed py-3 text-center text-[10px] uppercase tracking-wide transition-colors',
        isOver
          ? 'border-[var(--vscode-focusBorder)] bg-[var(--vscode-list-hoverBackground)] text-[var(--vscode-foreground)]'
          : 'border-[var(--vscode-panel-border)] text-[var(--vscode-descriptionForeground)]',
      ].join(' ')}
    >
      Drop here to append to root
    </div>
  );
}

/** Helper used by the shell when wiring drag-end events. */
export function isCanvasDropTarget(over: { data: { current?: { kind?: string } | null } | undefined }): boolean {
  return over?.data?.current?.kind === 'canvas-drop';
}

/** Read the parent path + index from a `canvas-drop` droppable. */
export function readCanvasDropTarget(
  over: { data: { current?: { kind?: string; parentPath?: readonly (number | string)[]; index?: number } | null } | undefined },
): { parentPath: readonly (number | string)[]; index: number } | null {
  const data = over?.data?.current;
  if (data?.kind !== 'canvas-drop') return null;
  return {
    parentPath: data.parentPath ?? [],
    index: data.index ?? 0,
  };
}

/** Used in the shell to give the user a passable reference type. */
export type BuilderCanvasUsedDefinition = BuilderDefinition;
