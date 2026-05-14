import { toPng, toSvg } from 'html-to-image';
import { getNodesBounds, type Node } from '@xyflow/react';

/**
 * Compute the rectangular extent of every node + a `padding`
 * margin so the exported image isn't cropped flush against the
 * outermost states. Used as the explicit width/height for the
 * `html-to-image` capture so React Flow's viewport doesn't have
 * to fit on screen first.
 */
function computeExportBounds(
  nodes: Node[],
  padding = 48,
): { x: number; y: number; width: number; height: number } {
  const bounds = getNodesBounds(nodes);
  return {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  };
}

/**
 * Background filter — drops the SmartGuides / BulkActionsToolbar
 * and similar overlay elements from the captured image. Returns
 * `false` to skip a node when serializing.
 */
function exportNodeFilter(node: HTMLElement): boolean {
  if (!node.classList) return true;
  const skip = ['react-flow__minimap', 'react-flow__controls', 'react-flow__panel', 'react-flow__attribution'];
  for (const cls of skip) {
    if (node.classList.contains(cls)) return false;
  }
  // Skip our overlay elements (SmartGuides etc.) — they're an
  // SVG with `aria-hidden`. Cast through `unknown` because
  // HTMLElement and SVGElement don't overlap structurally.
  if (node.tagName === 'svg') {
    const asSvg = node as unknown as SVGElement;
    if (asSvg.getAttribute('aria-hidden') === 'true') return false;
  }
  return true;
}

/**
 * Trigger a browser download for an arbitrary data-URL or Blob.
 * Safe across modern browsers; uses an off-DOM anchor click so
 * we don't leave debris in the page.
 */
function downloadDataUrl(dataUrl: string, fileName: string): void {
  const a = document.createElement('a');
  a.setAttribute('download', fileName);
  a.setAttribute('href', dataUrl);
  a.click();
}

interface ExportOptions {
  nodes: Node[];
  /** The React Flow viewport DOM element (the inner `.react-flow__viewport`). */
  viewport: HTMLElement;
  /** The outer wrapper, used to read computed background color. */
  wrapper: HTMLElement;
  fileNameBase?: string;
}

/**
 * Render the current React Flow graph as a PNG and trigger a
 * download. The export is "full bounds" — every node is included
 * regardless of viewport pan/zoom. Resolution is 2× to keep text
 * crisp on Retina displays.
 */
export async function exportCanvasPng({
  nodes,
  viewport,
  wrapper,
  fileNameBase = 'workflow',
}: ExportOptions): Promise<void> {
  const { width, height } = computeExportBounds(nodes);
  const backgroundColor =
    getComputedStyle(wrapper).getPropertyValue('--color-background').trim() || '#ffffff';

  const dataUrl = await toPng(viewport, {
    backgroundColor,
    width,
    height,
    pixelRatio: 2,
    filter: exportNodeFilter,
    cacheBust: true,
  });
  downloadDataUrl(dataUrl, `${fileNameBase}-${Date.now()}.png`);
}

/**
 * Same as `exportCanvasPng` but produces an SVG (vector). Useful
 * when the user wants to embed the diagram in slides or scale it
 * losslessly.
 */
export async function exportCanvasSvg({
  nodes,
  viewport,
  wrapper,
  fileNameBase = 'workflow',
}: ExportOptions): Promise<void> {
  const { width, height } = computeExportBounds(nodes);
  const backgroundColor =
    getComputedStyle(wrapper).getPropertyValue('--color-background').trim() || '#ffffff';

  const dataUrl = await toSvg(viewport, {
    backgroundColor,
    width,
    height,
    filter: exportNodeFilter,
    cacheBust: true,
  });
  downloadDataUrl(dataUrl, `${fileNameBase}-${Date.now()}.svg`);
}
