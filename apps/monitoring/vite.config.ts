import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  resolve: {
    alias: {
      '@monitoring': fileURLToPath(new URL('./src', import.meta.url)),
    },
    dedupe: ['react', 'react-dom'],
  },
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ['@vnext-forge-studio/designer-ui/editor'],
  },
  build: {
    outDir: './dist',
    emptyOutDir: true,
  },
  server: {
    port: 3100,
    proxy: {
      '/api': {
        target: 'http://localhost:4203',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
