import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: ['@vnext-forge/designer-ui/editor', '@monaco-editor/react', 'monaco-editor'],
  },
  build: {
    outDir: './dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
  },
});
