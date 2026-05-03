import * as esbuild from 'esbuild';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const production = process.argv.includes('--production');

// Resolve monorepo root (two levels up from apps/desktop/)
const monorepoRoot = path.resolve(__dirname, '..', '..');

/**
 * Copies @burgan-tech/vnext-template into dist/vendor so the template init
 * script is available as a real file on disk for child-process execution.
 * Mirrors the same plugin in apps/extension/esbuild.config.mjs.
 */
const copyVendorPlugin = {
  name: 'copy-vendor',
  setup(build) {
    build.onEnd(() => {
      const src = path.resolve(__dirname, 'node_modules/@burgan-tech/vnext-template');
      const dest = path.resolve(__dirname, 'dist/vendor/@burgan-tech/vnext-template');
      fs.rmSync(dest, { recursive: true, force: true });
      fs.cpSync(src, dest, { recursive: true, dereference: true });
      console.log('[esbuild] vendor copied');
    });
  },
};

/** @type {esbuild.BuildOptions} */
const sharedOptions = {
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  sourcemap: !production,
  minify: production,
};

// ── Electron main process ────────────────────────────────────────────────────
await esbuild.build({
  ...sharedOptions,
  entryPoints: ['src/main.ts'],
  outfile: 'dist/main.js',
  external: ['electron'],
});

// ── Preload script ───────────────────────────────────────────────────────────
await esbuild.build({
  ...sharedOptions,
  entryPoints: ['src/preload.ts'],
  outfile: 'dist/preload.js',
  external: ['electron'],
});

// ── Bundled Hono server (child process) ─────────────────────────────────────
// The server lives in apps/server/src/index.ts. We bundle it into a standalone
// CJS script so it can be spawned as `node dist/server.bundle.js` without the
// full monorepo on disk. @burgan-tech/vnext-template stays external and is
// copied into dist/vendor/ by copyVendorPlugin.
await esbuild.build({
  ...sharedOptions,
  entryPoints: [path.join(monorepoRoot, 'apps/server/src/index.ts')],
  outfile: 'dist/server.bundle.js',
  plugins: [copyVendorPlugin],
  external: ['@burgan-tech/vnext-template'],
  // Tell esbuild where to resolve workspace packages from
  absWorkingDir: monorepoRoot,
});

console.log('[esbuild] desktop build complete');
