/**
 * Reusable resizable + draggable shell for dialogs / modal panels.
 *
 * The vNext modals (`TransitionDialog`, `NewRunDialog`,
 * `HeadersConfigDialog`, ...) currently use plain `<div>` boxes with
 * fixed `w-[Npx] max-h-[80vh]`. That makes them feel claustrophobic
 * when the underlying schema or payload grows large. Wrapping the box
 * in `<ResizableDialogShell>` adds:
 *
 *   - **Drag-resize** from any edge (`top` / `right` / `bottom` /
 *     `left`) and any corner. Min / max sizes are clamped to the
 *     viewport so the user never loses the dialog off-screen.
 *   - **Drag-move** from the dialog header (any element with
 *     `data-dialog-handle="drag"` is treated as a drag target).
 *   - **Persisted geometry** — pass a `storageKey` to remember the
 *     user's chosen size + position for that dialog across reopens.
 *   - **Reset** button surfaced when the user has resized at least
 *     once (so they can always recover the default geometry).
 *
 * The component is purely presentational: it does NOT render the
 * backdrop. Hosts wrap it in their existing `<div className="fixed
 * inset-0 ... bg-black/50">` overlay and pass the dialog body as
 * `children`.
 */
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

interface DialogGeometry {
  width: number;
  height: number;
  /** Optional pinned position. When undefined the shell is centered. */
  x?: number;
  y?: number;
}

type ResizeDirection =
  | 'n'
  | 's'
  | 'e'
  | 'w'
  | 'ne'
  | 'nw'
  | 'se'
  | 'sw';

export interface ResizableDialogShellProps {
  /** Initial width (px). Default 600. */
  defaultWidth?: number;
  /** Initial height (px). Default `min(640, 0.8 * viewport)`. */
  defaultHeight?: number;
  /** Minimum width allowed during drag-resize (px). Default 360. */
  minWidth?: number;
  /** Minimum height allowed during drag-resize (px). Default 240. */
  minHeight?: number;
  /**
   * Optional `localStorage` key. When set the shell persists size +
   * position so reopening the dialog reuses the user's last layout.
   */
  storageKey?: string;
  /** Forwarded to the outer box (border + bg utility classes). */
  className?: string;
  /** ARIA label / labelledby — wired to the outer box for a11y. */
  ariaLabelledBy?: string;
  ariaLabel?: string;
  /**
   * Hosts can supply a ref to the modal box (e.g. for autoFocus). It is
   * forwarded to the outer container element.
   */
  containerRef?: React.RefObject<HTMLDivElement | null>;
  children: ReactNode;
}

const DEFAULT_MIN_WIDTH = 360;
const DEFAULT_MIN_HEIGHT = 240;

function readPersistedGeometry(storageKey: string | undefined): DialogGeometry | null {
  if (!storageKey) return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DialogGeometry> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.width !== 'number' || typeof parsed.height !== 'number') return null;
    return {
      width: parsed.width,
      height: parsed.height,
      ...(typeof parsed.x === 'number' ? { x: parsed.x } : {}),
      ...(typeof parsed.y === 'number' ? { y: parsed.y } : {}),
    };
  } catch {
    return null;
  }
}

function persistGeometry(storageKey: string | undefined, geometry: DialogGeometry): void {
  if (!storageKey) return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(geometry));
  } catch {
    // localStorage may be disabled (private mode etc.) — ignore
  }
}

function clearPersistedGeometry(storageKey: string | undefined): void {
  if (!storageKey) return;
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // ignore
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function ResizableDialogShell({
  defaultWidth = 600,
  defaultHeight,
  minWidth = DEFAULT_MIN_WIDTH,
  minHeight = DEFAULT_MIN_HEIGHT,
  storageKey,
  className = '',
  ariaLabelledBy,
  ariaLabel,
  containerRef,
  children,
}: ResizableDialogShellProps) {
  // Compute the initial geometry once on mount. We default the height
  // to ~80% of the viewport (capped at 720px) so very tall content
  // still stays comfortably scrollable.
  const computeDefaultGeometry = useCallback((): DialogGeometry => {
    const viewportH =
      typeof window !== 'undefined' ? window.innerHeight : 800;
    const viewportW =
      typeof window !== 'undefined' ? window.innerWidth : 1280;
    const fallbackH = Math.min(720, Math.round(viewportH * 0.8));
    return {
      width: clamp(defaultWidth, minWidth, Math.round(viewportW * 0.95)),
      height: clamp(defaultHeight ?? fallbackH, minHeight, Math.round(viewportH * 0.95)),
    };
  }, [defaultWidth, defaultHeight, minWidth, minHeight]);

  const [geometry, setGeometry] = useState<DialogGeometry>(() => {
    const persisted = readPersistedGeometry(storageKey);
    if (persisted) {
      const def = computeDefaultGeometry();
      // Clamp persisted geometry to the current viewport — if the user
      // resized their window since the last session, an old position
      // could be off-screen.
      const viewportW =
        typeof window !== 'undefined' ? window.innerWidth : def.width + 200;
      const viewportH =
        typeof window !== 'undefined' ? window.innerHeight : def.height + 200;
      const next: DialogGeometry = {
        width: clamp(persisted.width, minWidth, Math.round(viewportW * 0.95)),
        height: clamp(persisted.height, minHeight, Math.round(viewportH * 0.95)),
        ...(persisted.x !== undefined
          ? { x: clamp(persisted.x, 0, Math.max(0, viewportW - persisted.width)) }
          : {}),
        ...(persisted.y !== undefined
          ? { y: clamp(persisted.y, 0, Math.max(0, viewportH - persisted.height)) }
          : {}),
      };
      return next;
    }
    return computeDefaultGeometry();
  });

  // Track whether the user has interacted at all — controls whether the
  // "Reset layout" affordance shows up.
  const userInteractedRef = useRef(false);
  const [showReset, setShowReset] = useState(false);

  // Persist on every change once interaction has started.
  useEffect(() => {
    if (!userInteractedRef.current) return;
    persistGeometry(storageKey, geometry);
  }, [geometry, storageKey]);

  // ── Resize logic ─────────────────────────────────────────────────────────

  const handleResizeStart = useCallback(
    (direction: ResizeDirection) => (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      userInteractedRef.current = true;
      setShowReset(true);
      const startX = event.clientX;
      const startY = event.clientY;
      const startGeo = geometry;
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      const maxW = Math.round(viewportW * 0.95);
      const maxH = Math.round(viewportH * 0.95);

      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        let nextW = startGeo.width;
        let nextH = startGeo.height;
        let nextX = startGeo.x;
        let nextY = startGeo.y;

        if (direction.includes('e')) {
          nextW = clamp(startGeo.width + dx, minWidth, maxW);
        }
        if (direction.includes('w')) {
          const tentativeWidth = clamp(startGeo.width - dx, minWidth, maxW);
          if (nextX === undefined) {
            // Centered modal — pin to its current visual position
            // before flipping into manual mode so the box doesn't jump.
            const centerX = Math.round((viewportW - startGeo.width) / 2);
            nextX = centerX + (startGeo.width - tentativeWidth);
          } else {
            nextX = nextX + (startGeo.width - tentativeWidth);
          }
          nextW = tentativeWidth;
        }
        if (direction.includes('s')) {
          nextH = clamp(startGeo.height + dy, minHeight, maxH);
        }
        if (direction.includes('n')) {
          const tentativeHeight = clamp(startGeo.height - dy, minHeight, maxH);
          if (nextY === undefined) {
            const centerY = Math.round((viewportH - startGeo.height) / 2);
            nextY = centerY + (startGeo.height - tentativeHeight);
          } else {
            nextY = nextY + (startGeo.height - tentativeHeight);
          }
          nextH = tentativeHeight;
        }

        setGeometry({
          width: nextW,
          height: nextH,
          ...(nextX !== undefined ? { x: nextX } : {}),
          ...(nextY !== undefined ? { y: nextY } : {}),
        });
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [geometry, minWidth, minHeight],
  );

  // ── Drag-move logic ──────────────────────────────────────────────────────
  // Triggered by elements marked `data-dialog-handle="drag"` — typically
  // the dialog header. Listening on the outer box uses event delegation
  // so consumers don't need to wire individual handlers.
  const handleDragMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const handle = target.closest('[data-dialog-handle="drag"]');
      if (!handle) return;
      // Don't start a drag from interactive children of the header
      // (close button, breadcrumb links, etc.)
      const interactive = target.closest(
        'button, a, input, textarea, select, [role="button"]',
      );
      if (interactive && handle.contains(interactive) && interactive !== handle) return;

      event.preventDefault();
      userInteractedRef.current = true;
      setShowReset(true);
      const startX = event.clientX;
      const startY = event.clientY;
      const startGeo = geometry;
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;

      // If the dialog was centered we need to capture its visual
      // position before switching into manual mode.
      const startCenterX =
        startGeo.x ?? Math.round((viewportW - startGeo.width) / 2);
      const startCenterY =
        startGeo.y ?? Math.round((viewportH - startGeo.height) / 2);

      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const nextX = clamp(
          startCenterX + dx,
          0,
          Math.max(0, viewportW - startGeo.width),
        );
        const nextY = clamp(
          startCenterY + dy,
          0,
          Math.max(0, viewportH - startGeo.height),
        );
        setGeometry({
          width: startGeo.width,
          height: startGeo.height,
          x: nextX,
          y: nextY,
        });
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [geometry],
  );

  // ── Reset to defaults ────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    clearPersistedGeometry(storageKey);
    userInteractedRef.current = false;
    setShowReset(false);
    setGeometry(computeDefaultGeometry());
  }, [computeDefaultGeometry, storageKey]);

  const containerStyle = useMemo<CSSProperties>(() => {
    const style: CSSProperties = {
      width: geometry.width,
      height: geometry.height,
      // Cap relative to viewport even after manual drag-resize so window
      // shrinks don't leave the dialog stranded outside the screen.
      maxWidth: '95vw',
      maxHeight: '95vh',
    };
    if (geometry.x !== undefined && geometry.y !== undefined) {
      style.position = 'absolute';
      style.left = geometry.x;
      style.top = geometry.y;
    }
    return style;
  }, [geometry]);

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      {...(ariaLabelledBy ? { 'aria-labelledby': ariaLabelledBy } : {})}
      {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
      onMouseDown={handleDragMouseDown}
      style={containerStyle}
      className={`relative flex flex-col rounded border border-[var(--vscode-widget-border)] bg-[var(--vscode-editor-background,_theme(colors.background))] shadow-lg focus:outline-none ${className}`}
    >
      {children}

      {/* ── Resize handles ──────────────────────────────────────── */}
      {/* Edges */}
      <div
        onMouseDown={handleResizeStart('n')}
        className="absolute left-2 right-2 top-0 h-1 cursor-ns-resize hover:bg-[var(--vscode-focusBorder)]/30"
        aria-hidden="true"
      />
      <div
        onMouseDown={handleResizeStart('s')}
        className="absolute bottom-0 left-2 right-2 h-1 cursor-ns-resize hover:bg-[var(--vscode-focusBorder)]/30"
        aria-hidden="true"
      />
      <div
        onMouseDown={handleResizeStart('w')}
        className="absolute bottom-2 left-0 top-2 w-1 cursor-ew-resize hover:bg-[var(--vscode-focusBorder)]/30"
        aria-hidden="true"
      />
      <div
        onMouseDown={handleResizeStart('e')}
        className="absolute bottom-2 right-0 top-2 w-1 cursor-ew-resize hover:bg-[var(--vscode-focusBorder)]/30"
        aria-hidden="true"
      />
      {/* Corners */}
      <div
        onMouseDown={handleResizeStart('nw')}
        className="absolute left-0 top-0 h-2 w-2 cursor-nwse-resize hover:bg-[var(--vscode-focusBorder)]/40"
        aria-hidden="true"
      />
      <div
        onMouseDown={handleResizeStart('ne')}
        className="absolute right-0 top-0 h-2 w-2 cursor-nesw-resize hover:bg-[var(--vscode-focusBorder)]/40"
        aria-hidden="true"
      />
      <div
        onMouseDown={handleResizeStart('sw')}
        className="absolute bottom-0 left-0 h-2 w-2 cursor-nesw-resize hover:bg-[var(--vscode-focusBorder)]/40"
        aria-hidden="true"
      />
      <div
        onMouseDown={handleResizeStart('se')}
        className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize hover:bg-[var(--vscode-focusBorder)]/40"
        aria-hidden="true"
      >
        {/* Corner grip glyph — visible affordance so users notice they can resize */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-0 text-[8px] leading-none text-[var(--vscode-descriptionForeground)]"
        >
          ◢
        </span>
      </div>
    </div>
  );
}
