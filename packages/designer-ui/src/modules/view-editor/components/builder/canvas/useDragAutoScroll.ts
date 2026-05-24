/**
 * Auto-scroll a container while an HTML5 native drag is in progress.
 *
 * Problem: Once a user starts dragging a palette card, the browser
 * stops dispatching wheel / pointer events to anything except the
 * dragover/dragleave/drop handlers. If the canvas content is taller
 * than its scroll viewport, the user cannot bring the bottom (or top)
 * portion into view without releasing the drag.
 *
 * Solution: on `dragover`, measure the cursor's distance to the
 * scroll container's top/bottom edges; if it is within
 * `EDGE_THRESHOLD_PX`, schedule a `requestAnimationFrame` loop that
 * scrolls the container at a ramped speed proportional to the
 * encroachment. The loop self-cancels when the cursor leaves the
 * edge zone, the drag ends, or the component unmounts.
 *
 * Usage:
 *   const { ref, onDragOver, onDragLeave, onDragEnd, onDrop } =
 *     useDragAutoScroll();
 *   <div ref={ref} onDragOver={onDragOver} ... />
 *
 * The hook is read-only — it does not call preventDefault on the
 * dragover event (the SDK's DesignerNode handlers do that). It
 * simply observes cursor position alongside whatever else the
 * runtime is doing.
 */
import { useCallback, useEffect, useRef } from 'react';

const EDGE_THRESHOLD_PX = 48;
const MAX_SPEED_PX_PER_FRAME = 18;

interface DragAutoScrollAPI {
  ref: React.RefObject<HTMLDivElement | null>;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onDrop: () => void;
}

export function useDragAutoScroll(): DragAutoScrollAPI {
  const ref = useRef<HTMLDivElement | null>(null);
  const speedRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  const cancelLoop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    speedRef.current = 0;
  }, []);

  const runLoop = useCallback(() => {
    const el = ref.current;
    if (!el || speedRef.current === 0) {
      frameRef.current = null;
      return;
    }
    el.scrollBy({ top: speedRef.current });
    frameRef.current = requestAnimationFrame(runLoop);
  }, []);

  const onDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const fromTop = e.clientY - rect.top;
      const fromBottom = rect.bottom - e.clientY;

      let next = 0;
      if (fromTop < EDGE_THRESHOLD_PX) {
        const ratio = 1 - fromTop / EDGE_THRESHOLD_PX;
        next = -Math.ceil(ratio * MAX_SPEED_PX_PER_FRAME);
      } else if (fromBottom < EDGE_THRESHOLD_PX) {
        const ratio = 1 - fromBottom / EDGE_THRESHOLD_PX;
        next = Math.ceil(ratio * MAX_SPEED_PX_PER_FRAME);
      }

      speedRef.current = next;

      if (next !== 0 && frameRef.current === null) {
        frameRef.current = requestAnimationFrame(runLoop);
      } else if (next === 0) {
        cancelLoop();
      }
    },
    [cancelLoop, runLoop],
  );

  const onDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      // dragleave fires for child boundaries too. Only stop when the
      // cursor has actually left the scroll container.
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!inside) cancelLoop();
    },
    [cancelLoop],
  );

  const onDragEnd = useCallback(() => cancelLoop(), [cancelLoop]);
  const onDrop = useCallback(() => cancelLoop(), [cancelLoop]);

  useEffect(() => () => cancelLoop(), [cancelLoop]);

  return { ref, onDragOver, onDragLeave, onDragEnd, onDrop };
}
