import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@app': path.resolve(__dirname, './src/app'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@modules': path.resolve(__dirname, './src/modules'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
  build: {
    // Output directly into the extension's expected webview asset directory.
    // The extension reads the generated index.html and rewrites asset URIs via
    // webview.asWebviewUri() before serving it as the webview content.
    outDir: '../extension/dist/webview',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
  },
})
