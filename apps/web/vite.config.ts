import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
    },
    dedupe: ['react', 'react-dom'],
  },
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: ['@monaco-editor/react', 'monaco-editor'],
    exclude: ['@vnext-forge-studio/designer-ui/editor'],
  },
  build: {
    outDir: './dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
  },
});
