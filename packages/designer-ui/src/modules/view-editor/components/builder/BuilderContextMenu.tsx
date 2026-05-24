/**
 * R13: floating context menu for builder structural actions.
 *
 * Opened from both the canvas (right-click on a `[data-pseudo-path]`
 * node in the SDK shadow tree) and outline rows. The parent shell
 * (`PseudoUiBuilder`) owns the `{ x, y, path }` state and renders one
 * instance of this menu — both surfaces just call `onOpen(path, x, y)`.
 *
 * Rendered through a portal into `document.body` so the menu can
 * escape any scrolling / overflow:hidden ancestor and align next to
 * the user's pointer without being clipped.
 *
 * Closes on:
 *   - mousedown anywhere outside (`pointerdown` capture catches both
 *     left and right clicks; on right-click we leave the close to the
 *     normal capture handler so the next right-click reopens cleanly)
 *   - Escape key
 *   - any of its own item activations
 */

import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Copy, CopyPlus, MoveDown, MoveUp, Trash2 } from 'lucide-react';

import { type BuilderStore } from './state/builderStore';
import { getNode } from './utils/nodeOps';
import { type NodePath } from './types';

export interface BuilderContextMenuState {
  x: number;
  y: number;
  path: NodePath;
}

export interface BuilderContextMenuProps {
  store: BuilderStore;
  state: BuilderContextMenuState | null;
  onClose: () => void;
}

const MENU_MIN_WIDTH = 180;
const MENU_VIEWPORT_MARGIN = 8;

export function BuilderContextMenu({ store, state, onClose }: BuilderContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [adjusted, setAdjusted] = useState<{ x: number; y: number } | null>(null);

  // Re-clamp on every open.
  useLayoutEffect(() => {
    if (!state) {
      setAdjusted(null);
      return;
    }
    const el = menuRef.current;
    if (!el) {
      setAdjusted({ x: state.x, y: state.y });
      return;
    }
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = state.x;
    let y = state.y;
    if (x + rect.width + MENU_VIEWPORT_MARGIN > vw) {
      x = Math.max(MENU_VIEWPORT_MARGIN, vw - rect.width - MENU_VIEWPORT_MARGIN);
    }
    if (y + rect.height + MENU_VIEWPORT_MARGIN > vh) {
      y = Math.max(MENU_VIEWPORT_MARGIN, vh - rect.height - MENU_VIEWPORT_MARGIN);
    }
    setAdjusted({ x, y });
  }, [state]);

  // Outside click + escape to close.
  useEffect(() => {
    if (!state) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = menuRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    // Capture phase so we intercept before any other handler.
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [state, onClose]);

  const node = useMemo(() => {
    if (!state) return null;
    const def = store.getState().definition;
    return getNode(def.view, state.path);
  }, [state, store]);

  if (!state || !node) return null;

  const path = state.path;
  const lastSegment = path[path.length - 1];
  const isIndexedSlot = typeof lastSegment === 'number';
  const parentPath = path.slice(0, -1);

  // Compute siblings count to enable / disable move up/down.
  let siblingsLen = 0;
  if (isIndexedSlot) {
    const parentDef = store.getState().definition.view;
    const parentNode = getNode(parentDef, parentPath);
    if (parentNode) {
      // The container behind the numeric segment is either `children`,
      // an arbitrary array slot we walked into (e.g. tabs[i].content),
      // or — rarely — the parent itself when it's an array (defensive).
      // For move up/down we only need the length of the array the index
      // lives in. We approximate by reading the standard `children`;
      // tabs / content paths still use numeric segments so the same lookup
      // logic in store.moveNode handles them, but the count is best-effort.
      const children = (parentNode as { children?: unknown[] }).children;
      if (Array.isArray(children)) siblingsLen = children.length;
    }
  }
  const indexInParent = typeof lastSegment === 'number' ? lastSegment : -1;
  const canMoveUp = isIndexedSlot && indexInParent > 0;
  const canMoveDown = isIndexedSlot && indexInParent >= 0 && indexInParent < siblingsLen - 1;
  const canDuplicate = isIndexedSlot;
  const isRoot = path.length === 0;

  const handleDuplicate = (): void => {
    if (!canDuplicate) return;
    store.getState().duplicateNode(path);
    onClose();
  };
  const handleDelete = (): void => {
    if (isRoot) return;
    store.getState().deleteNode(path);
    onClose();
  };
  const handleMoveUp = (): void => {
    if (!canMoveUp) return;
    store.getState().moveNode(path, parentPath, indexInParent - 1);
    onClose();
  };
  const handleMoveDown = (): void => {
    if (!canMoveDown) return;
    // After removal the target index shifts by -1, so passing
    // (indexInParent + 1) requests insertion AFTER the next sibling.
    store.getState().moveNode(path, parentPath, indexInParent + 1);
    onClose();
  };
  const handleCopyJson = (): void => {
    try {
      const text = JSON.stringify(node, null, 2);
      void navigator.clipboard?.writeText(text);
    } catch {
      // ignore — copy is best-effort
    }
    onClose();
  };

  const pos = adjusted ?? { x: state.x, y: state.y };
  const visible = adjusted !== null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Node actions"
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        minWidth: MENU_MIN_WIDTH,
        zIndex: 9999,
        visibility: visible ? 'visible' : 'hidden',
      }}
      className="overflow-hidden rounded border border-primary-border bg-primary py-1 text-[12px] text-primary-text shadow-lg"
    >
      <MenuItem
        icon={<CopyPlus size={12} aria-hidden />}
        label="Duplicate"
        shortcut={modKeyLabel('D')}
        disabled={!canDuplicate}
        onClick={handleDuplicate}
      />
      <MenuItem
        icon={<Trash2 size={12} aria-hidden />}
        label="Delete"
        shortcut="Del"
        disabled={isRoot}
        onClick={handleDelete}
        danger
      />
      <MenuSeparator />
      <MenuItem
        icon={<MoveUp size={12} aria-hidden />}
        label="Move up"
        disabled={!canMoveUp}
        onClick={handleMoveUp}
      />
      <MenuItem
        icon={<MoveDown size={12} aria-hidden />}
        label="Move down"
        disabled={!canMoveDown}
        onClick={handleMoveDown}
      />
      <MenuSeparator />
      <MenuItem
        icon={<Copy size={12} aria-hidden />}
        label="Copy as JSON"
        onClick={handleCopyJson}
      />
    </div>,
    document.body,
  );
}

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}

function MenuItem({ icon, label, shortcut, disabled, danger, onClick }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={[
        'flex w-full items-center gap-2 px-3 py-1 text-left',
        disabled
          ? 'cursor-not-allowed text-[var(--vscode-disabledForeground)] opacity-60'
          : 'hover:bg-[var(--vscode-list-hoverBackground)]',
        danger && !disabled
          ? 'text-[var(--vscode-errorForeground,var(--vscode-foreground))]'
          : '',
      ].join(' ')}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut ? (
        <span className="text-[10px] text-muted-text">{shortcut}</span>
      ) : null}
    </button>
  );
}

function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-[var(--vscode-panel-border)]" />;
}

/** Render a platform-appropriate modifier label (⌘ on macOS, Ctrl elsewhere). */
function modKeyLabel(key: string): string {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform);
  return isMac ? `⌘${key}` : `Ctrl+${key}`;
}
