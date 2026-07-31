import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Mirrors the `@monitoring` alias in vite.config.ts so component tests can
    // import modules that reach shared code through the alias.
    alias: {
      '@monitoring': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.vitest.test.{ts,tsx}'],
  },
});
