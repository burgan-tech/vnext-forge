/**
 * Ambient type declarations for Vite `?url` asset imports.
 *
 * The designer-ui tsconfig sets `types: []` (no `vite/client`), so we
 * declare the `?url` suffix locally. The resulting string is the bundled
 * asset URL (hashed in production, dev URL in development) — usable as
 * the `href` of a `<link>` tag, including inside iframes.
 */
declare module '*.css?url' {
  const url: string;
  export default url;
}

declare module '*.css?raw' {
  const source: string;
  export default source;
}
