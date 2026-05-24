/**
 * New pseudo-ui visual builder.
 *
 * Layout (Builder mode):
 *
 *   ┌──────────┬─────────────────────────────┬──────────────┐
 *   │ Palette  │          Canvas             │  Inspector   │
 *   │          ├─────────────────────────────┤              │
 *   │          │          Outline            │              │
 *   └──────────┴─────────────────────────────┴──────────────┘
 *
 * The shell owns:
 *   - A Zustand store (one per mount).
 *   - The `@dnd-kit` DndContext that routes palette drops and outline reorders.
 *   - Synchronizing store changes back to the host via `onContentChange`.
 *   - Three top-level modes: Builder / JSON / Preview.
 *
 * Schema discovery (for the dataSchema picker & bind autocomplete) is opt-in
 * via the optional `projectId` prop. When omitted (e.g. early in a fresh
 * project), bind fields fall back to free-text and the schema picker shows
 * only manual URN entry.
 */

import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';

import { JsonCodeField } from '../../../../ui/JsonCodeField';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '../../../../ui/Resizable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../ui/Tabs';
import { PseudoUiViewSurface } from '../../../quick-run/pseudo-ui/PseudoUiViewSurface';
import type { ViewResponse } from '../../../quick-run/types/quickrun.types';
import { ViewRenderer } from '@vnext-forge-studio/vnext-types';

import { BuilderCanvas } from './canvas/BuilderCanvas';
import { LeftRail } from './LeftRail';
import { PropertyInspector } from './inspector/PropertyInspector';
import { createBuilderStore } from './state/builderStore';
import { type BuilderDefinition, type NodePath } from './types';
import {
  parseBuilderDefinition,
  serializeBuilderDefinition,
} from './utils/normalizeDefinition';

export interface PseudoUiBuilderProps {
  /** JSON string from the view file's `attributes.content`. */
  content: string;
  /** Push serialized JSON back to the host (View Editor panel). */
  onContentChange: (next: string) => void;
  /** Display key used as a stable id for the rendered preview. */
  viewKey: string;
  /** Optional schema discovery hooks supplied by the host. */
  availableSchemas?: readonly { urn: string; label: string }[];
  loadSchema?: (urn: string) => Promise<unknown>;
}

type BuilderMode = 'builder' | 'json' | 'preview';

export function PseudoUiBuilder({
  content,
  onContentChange,
  viewKey,
  availableSchemas,
  loadSchema,
}: PseudoUiBuilderProps) {
  // ── Mode ────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<BuilderMode>('builder');

  // ── Inspector visibility ───────────────────────────────────────────
  // Manual toggle (chevron in canvas) hides the right panel for a
  // wider canvas. Selecting a different node auto-opens the inspector
  // again (a no-op if the selection didn't actually change, so the
  // user's "close" stays in effect when they re-click the same node).
  const [inspectorOpen, setInspectorOpen] = useState(true);

  // ── Store ───────────────────────────────────────────────────────────
  // Lazily create one store per mount; sync incoming content edits into it.
  // `useRef` initializer runs once — that's the intent.
  const storeRef = useRef(createBuilderStore(parseBuilderDefinition(content)));
  const store = storeRef.current;
  const definition = useStore(store, (s) => s.definition);

  // ── Outbound sync (store → host) ────────────────────────────────────
  const lastEmittedRef = useRef<string>('');
  useEffect(() => {
    const serialized = serializeBuilderDefinition(definition);
    if (serialized === lastEmittedRef.current) return;
    lastEmittedRef.current = serialized;
    // Avoid emitting on the very first render where the incoming content
    // matches the parsed-then-serialized round-trip.
    if (serialized === content || normalizeJson(serialized) === normalizeJson(content)) return;
    onContentChange(serialized);
  }, [definition, content, onContentChange]);

  // ── Auto-open inspector when selection changes to a node ──────────
  useEffect(() => {
    return store.subscribe((state, prev) => {
      const prevPath = prev.selectedPath;
      const nextPath = state.selectedPath;
      if (nextPath !== prevPath && nextPath !== null && nextPath.length >= 0) {
        setInspectorOpen(true);
      }
    });
  }, [store]);

  // ── Inbound sync (host → store) ─────────────────────────────────────
  useEffect(() => {
    if (normalizeJson(content) === normalizeJson(lastEmittedRef.current)) return;
    const parsed = parseBuilderDefinition(content);
    store.getState().setDefinition(parsed, { recordHistory: false, pruneSelection: true });
    lastEmittedRef.current = serializeBuilderDefinition(parsed);
  }, [content, store]);

  // ── JSON mode buffer ────────────────────────────────────────────────
  const [jsonBuffer, setJsonBuffer] = useState<string>(() => serializeBuilderDefinition(definition));
  const [jsonError, setJsonError] = useState<string | null>(null);
  useEffect(() => {
    if (mode === 'json') {
      setJsonBuffer(serializeBuilderDefinition(definition));
      setJsonError(null);
    }
  }, [definition, mode]);

  const commitJson = useCallback(
    (next: string) => {
      setJsonBuffer(next);
      try {
        const parsed: unknown = JSON.parse(next);
        if (!parsed || typeof parsed !== 'object' || !('view' in parsed)) {
          setJsonError('Definition must be an object with a "view" field.');
          return;
        }
        setJsonError(null);
        store.getState().setDefinition(parsed as BuilderDefinition);
      } catch (e) {
        setJsonError(e instanceof Error ? e.message : 'Invalid JSON');
      }
    },
    [store],
  );

  // ── Dnd-kit wiring (outline-only since R11) ─────────────────────────
  // Palette → canvas drag-drop is handled by the SDK's `designer="edit"`
  // mode via HTML5 native dataTransfer (see ComponentPalette.tsx). This
  // DndContext now only owns outline-tree reorder + insertion events.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;
      const overData = over.data.current as DropTargetData | undefined;
      const activeData = active.data.current as DragSourceData | undefined;
      if (!overData || !activeData) return;
      if (activeData.kind !== 'outline-drag') return;

      const targetParent = overData.parentPath;
      const targetIndex = overData.index;
      store.getState().moveNode(activeData.sourcePath, targetParent, targetIndex);
    },
    [store],
  );

  // ── Preview ViewResponse ────────────────────────────────────────────
  const previewResponse = useMemo<ViewResponse>(
    () => ({
      key: viewKey || 'preview',
      content: definition as unknown as Record<string, unknown>,
      type: 'Json',
      renderer: String(ViewRenderer.PseudoUi),
    }),
    [definition, viewKey],
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <Tabs value={mode} onValueChange={(v) => setMode(v as BuilderMode)} className="flex h-full min-h-0 flex-col">
        <TabsList className="shrink-0 self-start">
          <TabsTrigger value="builder">Builder</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="min-h-0 flex-1 overflow-hidden">
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <ResizablePanelGroup orientation="horizontal" className="h-full">
              <ResizablePanel defaultSize={22} minSize={16}>
                <LeftRail store={store} />
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize={inspectorOpen ? 52 : 78} minSize={30}>
                <BuilderCanvas
                  store={store}
                  viewKey={viewKey}
                  onEditAsJson={() => setMode('json')}
                  inspectorOpen={inspectorOpen}
                  onToggleInspector={() => setInspectorOpen((v) => !v)}
                />
              </ResizablePanel>
              {inspectorOpen ? (
                <>
                  <ResizableHandle />
                  <ResizablePanel defaultSize={26} minSize={18}>
                    <PropertyInspector
                      store={store}
                      availableSchemas={availableSchemas}
                      loadSchema={loadSchema}
                    />
                  </ResizablePanel>
                </>
              ) : null}
            </ResizablePanelGroup>
          </DndContext>
        </TabsContent>

        <TabsContent value="json" className="min-h-0 flex-1">
          <div className="flex h-full min-h-0 flex-col gap-2 p-2">
            {jsonError ? (
              <div
                role="alert"
                className="rounded border border-[var(--vscode-inputValidation-errorBorder)] bg-[var(--vscode-inputValidation-errorBackground)] px-2 py-1 text-[11px] text-[var(--vscode-errorForeground)]"
              >
                {jsonError}
              </div>
            ) : null}
            <JsonCodeField
              value={jsonBuffer}
              onChange={commitJson}
              height={520}
              aria-label="View definition JSON"
            />
          </div>
        </TabsContent>

        <TabsContent value="preview" className="min-h-0 flex-1">
          <div className="h-full min-h-0 p-2">
            <PseudoUiViewSurface
              viewResponse={previewResponse}
              mode="preview"
              designer="preview"
              ariaLabel="Pseudo-ui builder preview"
              fillHeight
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface OutlineDragData {
  kind: 'outline-drag';
  sourcePath: NodePath;
}
// R11: palette drag no longer goes through dnd-kit (HTML5 native → SDK).
type DragSourceData = OutlineDragData;

interface DropTargetData {
  kind: string;
  parentPath: NodePath;
  index: number;
}

function normalizeJson(input: string): string {
  if (input == null || input === '') return '';
  try {
    return JSON.stringify(JSON.parse(input));
  } catch {
    return input;
  }
}
