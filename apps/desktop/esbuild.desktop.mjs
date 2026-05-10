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
//
// The server source uses ESM-style `import.meta.url` for two purposes:
//  1. apps/server/src/shared/config/config.ts  — resolves the optional .env
//     file path relative to the bundle (used only in standalone server mode;
//     in desktop mode config comes from process.env set by the main process).
//  2. apps/server/src/composition/services.ts  — createRequire(import.meta.url)
//     for dynamic require of @burgan-tech/vnext-schema.
//
// esbuild's `define` replaces every `import.meta.url` in the bundle with its
// CJS equivalent so both usages work correctly at runtime without touching the
// server source code.
await esbuild.build({
  ...sharedOptions,
  entryPoints: [path.join(monorepoRoot, 'apps/server/src/index.ts')],
  outfile: path.join(__dirname, 'dist/server.bundle.js'),
  plugins: [copyVendorPlugin],
  external: [
    '@burgan-tech/vnext-template',
    // Native module — must NOT be inlined. node-pty's loader uses its own
    // module location to find `prebuilds/<platform>/pty.node`; if esbuild
    // inlines the JS, that path resolves relative to dist/ (where the .node
    // file is missing) and the require throws on first use.
    'node-pty',
  ],
  // esbuild's `define` only accepts JS literals or identifiers, not arbitrary
  // expressions. The two-step approach below polyfills `import.meta.url` for
  // the CJS bundle without touching server source code:
  //  1. define replaces every `import.meta.url` with the identifier __importMetaUrl
  //  2. banner injects the runtime value of that identifier at the top of the file
  define: {
    'import.meta.url': '__importMetaUrl',
  },
  banner: {
    js: 'const __importMetaUrl = require("url").pathToFileURL(__filename).href;',
  },
  // Tell esbuild where to resolve workspace packages from
  absWorkingDir: monorepoRoot,
});

console.log('[esbuild] desktop build complete');
