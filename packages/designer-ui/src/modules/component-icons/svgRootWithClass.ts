/**
 * Injects a `class` on the root `<svg>` of markup loaded from an `.svg` file.
 * Used with Vite `*.svg?raw` imports so Tailwind utilities apply to the SVG.
 */
export function svgRootWithClass(svgMarkup: string, className: string): string {
  const esc = className.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return svgMarkup.replace(/<svg\b/, `<svg class="${esc}"`);
}
