import { defineConfig } from 'vitest/config';

/**
 * Only `*.vitest.test.ts` under `src/`, matching the `designer-ui` convention.
 *
 * The extension host cannot be tested wholesale: `vscode` is an ambient module
 * supplied by the editor at runtime and resolves to nothing here, so anything
 * importing it is out of reach without a `@vscode/test-electron` harness. The
 * modules that *are* covered (`forge-config-locator`, `forge-config-bundle`,
 * `data-bucket.service`) are deliberately free of `vscode` imports for exactly
 * this reason — the decisions worth pinning live there, and the `vscode`-facing
 * code above them is kept thin enough to review by eye.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.vitest.test.ts'],
  },
});
