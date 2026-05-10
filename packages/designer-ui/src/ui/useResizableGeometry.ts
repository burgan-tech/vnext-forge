/**
 * Shared geometry state + drag/resize handlers for resizable modals.
 *
 * Both `ResizableDialogShell` (custom modal frame for `TransitionDialog`,
 * `NewRunDialog`, `HeadersConfigDialog`) and the Radix-based
 * `DialogContent` (`enableResize` mode) consume this hook so size /
 * position behave identically across the two tiers.
 *
 *   - `containerStyle` is applied to the modal box; clamps to 95vw/vh.
 *   - `handleDragMouseDown` accepts events from a `data-dialog-handle="drag"`
 *      element (typically the dialog header) and starts a move drag.
 *   - `handleResizeStart(direction)` returns a mouse-down handler for one
 *     of the eight edge / corner handles.
 *   - `handleReset` clears the persisted geometry and recomputes the
 *     default centered layout.
 *
 * Geometry is persisted to `localStorage[storageKey]` after the user
 * first interacts. Without a key the modal still resizes / drags, but
 * each open starts from the default centered layout.
 */
import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface DialogGeometry {
  width: number;
  height: number;
  /** Optional pinned position. When undefined the shell is centered. */
  x?: number;
  y?: number;
}

export type ResizeDirection =
  | 'n'
  | 's'
  | 'e'
  | 'w'
  | 'ne'
  | 'nw'
  | 'se'
  | 'sw';

export interface UseResizableGeometryOptions {
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  storageKey?: string;
}

const DEFAULT_MIN_WIDTH = 360;
const DEFAULT_MIN_HEIGHT = 240;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

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

function persistGeometry(
  storageKey: string | undefined,
  geometry: DialogGeometry,
): void {
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

export function useResizableGeometry({
  defaultWidth = 600,
  defaultHeight,
  minWidth = DEFAULT_MIN_WIDTH,
  minHeight = DEFAULT_MIN_HEIGHT,
  storageKey,
}: UseResizableGeometryOptions) {
  const computeDefaultGeometry = useCallback((): DialogGeometry => {
    const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const fallbackH = Math.min(720, Math.round(viewportH * 0.8));
    return {
      width: clamp(defaultWidth, minWidth, Math.round(viewportW * 0.95)),
      height: clamp(
        defaultHeight ?? fallbackH,
        minHeight,
        Math.round(viewportH * 0.95),
      ),
    };
  }, [defaultWidth, defaultHeight, minWidth, minHeight]);

  const [geometry, setGeometry] = useState<DialogGeometry>(() => {
    const persisted = readPersistedGeometry(storageKey);
    if (persisted) {
      const def = computeDefaultGeometry();
      const viewportW =
        typeof window !== 'undefined' ? window.innerWidth : def.width + 200;
      const viewportH =
        typeof window !== 'undefined' ? window.innerHeight : def.height + 200;
      return {
        width: clamp(persisted.width, minWidth, Math.round(viewportW * 0.95)),
        height: clamp(persisted.height, minHeight, Math.round(viewportH * 0.95)),
        ...(persisted.x !== undefined
          ? {
              x: clamp(
                persisted.x,
                0,
                Math.max(0, viewportW - persisted.width),
              ),
            }
          : {}),
        ...(persisted.y !== undefined
          ? {
              y: clamp(
                persisted.y,
                0,
                Math.max(0, viewportH - persisted.height),
              ),
            }
          : {}),
      };
    }
    return computeDefaultGeometry();
  });

  const userInteractedRef = useRef(false);
  const [showReset, setShowReset] = useState(false);

  useEffect(() => {
    if (!userInteractedRef.current) return;
    persistGeometry(storageKey, geometry);
  }, [geometry, storageKey]);

  const handleResizeStart = useCallback(
    (direction: ResizeDirection) => (event: ReactMouseEvent) => {
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

  const handleDragMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const handle = target.closest('[data-dialog-handle="drag"]');
      if (!handle) return;
      const interactive = target.closest(
        'button, a, input, textarea, select, [role="button"]',
      );
      if (interactive && handle.contains(interactive) && interactive !== handle) {
        return;
      }

      event.preventDefault();
      userInteractedRef.current = true;
      setShowReset(true);
      const startX = event.clientX;
      const startY = event.clientY;
      const startGeo = geometry;
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;

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
      maxWidth: '95vw',
      maxHeight: '95vh',
    };
    if (geometry.x !== undefined && geometry.y !== undefined) {
      style.position = 'fixed';
      style.left = geometry.x;
      style.top = geometry.y;
      // Override Radix's default `translate(-50%,-50%)` centering.
      style.transform = 'none';
    }
    return style;
  }, [geometry]);

  return {
    geometry,
    containerStyle,
    showReset,
    handleDragMouseDown,
    handleResizeStart,
    handleReset,
  };
}
