import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Vite config for the VS Code extension webview bundle.
 *
 * Multi-page build: `index.html` (designer) and `quickrun.html` (QuickRun panel).
 *
 * - `root` is set to this directory so `index.html` is the Vite entry.
 * - `base: ''` emits relative asset paths, which the extension rewrites via
 *   `webview.asWebviewUri()` in `panels/DesignerPanel.ts` at runtime.
 * - `outDir` points at `../dist/webview-ui` so the extension `files` glob
 *   (`dist/webview-ui/**`) picks up the bundle when packaging the `.vsix`.
 */
export default defineConfig({
  root: __dirname,
  base: '',
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: ['@vnext-forge/designer-ui/editor', '@monaco-editor/react', 'monaco-editor'],
  },
  build: {
    outDir: '../dist/webview-ui',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        quickrun: path.resolve(__dirname, 'quickrun.html'),
      },
    },
  },
  server: {
    port: 3100,
  },
});
