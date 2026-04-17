import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Vite config for the VS Code extension webview bundle.
 *
 * - `root` is set to this directory so `index.html` is the Vite entry.
 * - `base: ''` emits relative asset paths, which the extension rewrites via
 *   `webview.asWebviewUri()` in `WebviewPanelManager.ts` at runtime.
 * - `outDir` points at `../dist/webview` so the extension `files` glob
 *   (`dist/webview/**`) picks up the bundle when packaging the `.vsix`.
 */
export default defineConfig({
  root: __dirname,
  base: '',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../dist/webview',
    emptyOutDir: true,
  },
  server: {
    port: 3100,
  },
});
