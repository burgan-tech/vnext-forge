/**
 * Bridge between pseudo-ui SDK's designer-mode delegate callbacks and
 * the Forge builder store.
 *
 * The SDK's `<PseudoView designer="edit">` renders each node with a
 * thin interaction wrapper that fires:
 *
 *   - `delegate.onNodeSelect(path, node)`       on click
 *   - `delegate.onNodeHover(path, node)`        on enter/leave (unused here)
 *   - `delegate.onNodeDelete(path)`             on × button
 *   - `delegate.onNodeMove(from, toParent, key, index)`        on node→canvas drag
 *   - `delegate.onNodeDropFromPalette(targetParent, key, index, paletteType)` on palette→canvas drag
 *
 * SDK paths are JSON Pointer strings (`/view/children/0/...`). The
 * store keeps view-relative NodePath arrays. We translate via
 * `jsonPointerToNodePath` and skip events whose pointer references a
 * slot the store cannot mutate yet (returns null — see
 * `utils/jsonPointerPath.ts`).
 *
 * The `key` argument in move/drop callbacks is the container key the
 * SDK inferred from the parent's child slot (`children`, `template`,
 * `tabs`, …). Our store derives the same container from the parent
 * node's catalog metadata, so we pass through index only.
 *
 * `loadComponent` and `requestData` are required by the SDK's
 * `PseudoViewDelegate` type but unused for static design preview —
 * we return empty fixtures.
 */
import { useMemo } from 'react';
import { useStore } from 'zustand';
import type {
  ComponentNode,
  DataSchema,
  PseudoViewDelegate,
  ViewDefinition,
} from '@burgantech/pseudo-ui';

import { createNodeFromCatalog } from '../palette/componentCatalog';
import { jsonPointerToNodePath } from '../utils/jsonPointerPath';
import type { NodePath } from '../types';
import type { BuilderStore } from './builderStore';

export interface BuilderDesignerDelegateOptions {
  /** R15: receive live hover events so the canvas header breadcrumb
   *  can preview the hovered node. Called with `null` when the
   *  pointer leaves any designer node. */
  onHover?: (path: NodePath | null) => void;
}

const EMPTY_VIEW: ViewDefinition = {
  $schema: '',
  dataSchema: '',
  view: { type: 'Column' },
};

const EMPTY_SCHEMA = {} as DataSchema;

export function useBuilderDesignerDelegate(
  store: BuilderStore,
  options: BuilderDesignerDelegateOptions = {},
): PseudoViewDelegate {
  const { onHover } = options;
  const selectNode = useStore(store, (s) => s.selectNode);
  const deleteNode = useStore(store, (s) => s.deleteNode);
  const moveNode = useStore(store, (s) => s.moveNode);
  const insertNode = useStore(store, (s) => s.insertNode);

  return useMemo<PseudoViewDelegate>(
    () => ({
      requestData: () => Promise.resolve(undefined),
      loadComponent: () => Promise.resolve({ schema: EMPTY_SCHEMA, view: EMPTY_VIEW }),
      onAction: () => Promise.resolve(undefined),

      onNodeSelect: (pointer: string, _node: ComponentNode) => {
        const path = jsonPointerToNodePath(pointer);
        if (path === null) return;
        selectNode(path);
      },

      onNodeHover: (pointer: string | null, _node: ComponentNode | null) => {
        if (!onHover) return;
        if (pointer === null) {
          onHover(null);
          return;
        }
        const path = jsonPointerToNodePath(pointer);
        // Silently ignore hover events whose pointer references a
        // slot we cannot model. The breadcrumb just keeps the prior
        // value (or selection) in that case.
        if (path === null) return;
        onHover(path);
      },

      onNodeDelete: (pointer: string) => {
        const path = jsonPointerToNodePath(pointer);
        if (path === null) return;
        deleteNode(path);
      },

      onNodeMove: (fromPointer: string, toParentPointer: string, _key: string, index: number) => {
        const from = jsonPointerToNodePath(fromPointer);
        const toParent = jsonPointerToNodePath(toParentPointer);
        if (from === null || toParent === null) return;
        moveNode(from, toParent, index);
      },

      onNodeDropFromPalette: (
        targetParentPointer: string,
        _key: string,
        index: number,
        paletteType: string,
      ) => {
        const parent = jsonPointerToNodePath(targetParentPointer);
        if (parent === null) return;
        const node = createNodeFromCatalog(paletteType);
        if (!node) return;
        insertNode(parent, index, node);
      },
    }),
    [selectNode, deleteNode, moveNode, insertNode, onHover],
  );
}
