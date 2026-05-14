/**
 * Document-global SVG `<defs>` of arrowhead markers reused by every
 * TransitionEdge instance.
 *
 * Why this exists
 * ───────────────
 * The previous design embedded `<defs><marker id="marker-${edgeId}" .../></defs>`
 * inside every edge's returned JSX, which meant N edges produced N
 * marker elements in the live DOM. On large workflows (50+ edges)
 * this measurably slows up GPU compositing and re-renders, even
 * though the markers all paint the same five-or-so shapes.
 *
 * This component renders a single hidden 0×0 SVG containing one
 * marker per trigger type + state combination. SVG IDs are
 * document-scoped, so any `markerEnd="url(#vf-marker-auto)"` reference
 * inside React Flow's main SVG resolves to one of these markers.
 *
 * Marker IDs follow the convention `vf-marker-{kind}` so they can't
 * collide with React Flow's own marker IDs (`react-flow__arrowclosed-…`).
 *
 * Sizing
 * ──────
 * `markerWidth/markerHeight = 10` (was 7 in the per-edge version) —
 * arrowheads are now significantly more visible at default zoom and
 * at the 0.3 minimum zoom level. The triangle is drawn in a 10×10
 * viewBox with refX=10/refY=5 so the tip lands exactly on the edge
 * endpoint and the arrow points outward.
 */

const MARKER_VIEW_BOX = '0 0 10 10';
const TRIANGLE_PATH = 'M 0 0 L 10 5 L 0 10 Z';

interface MarkerDef {
  id: string;
  fill: string;
}

const MARKERS: readonly MarkerDef[] = [
  // Manual / default — terminated palette (most-used edges).
  { id: 'vf-marker-manual', fill: 'var(--color-final-terminated)' },
  // Auto trigger — emerald. Same hue as the auto edge stroke.
  { id: 'vf-marker-auto', fill: 'var(--color-trigger-auto)' },
  // Auto + default kind (triggerKind === 10) — muted slate.
  { id: 'vf-marker-auto-default', fill: 'var(--color-muted-border)' },
  // Scheduled / cron trigger — amber.
  { id: 'vf-marker-scheduled', fill: 'var(--color-trigger-scheduled)' },
  // Event trigger — violet.
  { id: 'vf-marker-event', fill: 'var(--color-trigger-event)' },
  // Shared transition — terminated palette (matches the dashed shared stroke).
  { id: 'vf-marker-shared', fill: 'var(--color-final-terminated)' },
];

/**
 * Size is parameter-driven so the same marker pool can re-render at a
 * different scale when the user changes the `Arrow Size` setting in
 * Canvas Options. The viewBox stays 10×10 (the triangle's logical
 * coordinate space); only `markerWidth`/`markerHeight` and `refX/Y`
 * change. `refY` is always size/2 to keep the tip horizontally
 * centered on the edge endpoint.
 */
export function SharedEdgeMarkers({ size = 10 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={0}
      height={0}
      style={{ position: 'absolute', overflow: 'hidden' }}
    >
      <defs>
        {MARKERS.map((m) => (
          <marker
            key={m.id}
            id={m.id}
            viewBox={MARKER_VIEW_BOX}
            refX={10}
            refY={5}
            markerWidth={size}
            markerHeight={size}
            orient="auto-start-reverse"
          >
            <path d={TRIANGLE_PATH} fill={m.fill} />
          </marker>
        ))}
      </defs>
    </svg>
  );
}

/**
 * Resolve the right shared marker id for an edge given its trigger
 * properties. Returns the URL string ready to pass into BaseEdge's
 * `markerEnd` prop.
 */
export function pickMarkerEnd({
  triggerType,
  triggerKind,
  isShared,
}: {
  triggerType: number;
  triggerKind: number;
  isShared: boolean;
}): string {
  if (isShared) return 'url(#vf-marker-shared)';
  switch (triggerType) {
    case 1:
      if (triggerKind === 10) return 'url(#vf-marker-auto-default)';
      return 'url(#vf-marker-auto)';
    case 2:
      return 'url(#vf-marker-scheduled)';
    case 3:
      return 'url(#vf-marker-event)';
    case 0:
    default:
      return 'url(#vf-marker-manual)';
  }
}
