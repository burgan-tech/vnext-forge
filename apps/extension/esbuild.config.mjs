import * as esbuild from 'esbuild';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * Post-build plugin: copies @burgan-tech/vnext-template into dist/vendor so
 * it is available as a real file on disk. The template init script is executed
 * as a child process and resolves template files via __filename — it cannot
 * be inlined by esbuild.
 */
const copyVendorPlugin = {
  name: 'copy-vendor',
  setup(build) {
    build.onEnd(() => {
      const src = path.resolve(__dirname, 'node_modules/@burgan-tech/vnext-template');
      const dest = path.resolve(__dirname, 'dist/vendor/@burgan-tech/vnext-template');
      // dereference: true — follow pnpm symlinks and copy real files into dist/
      // force: true — overwrite previous build output cleanly
      fs.rmSync(dest, { recursive: true, force: true });
      fs.cpSync(src, dest, { recursive: true, dereference: true });
    });
  },
};

/** @type {esbuild.BuildOptions} */
const buildOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  plugins: [copyVendorPlugin],
  // vscode is provided by the extension host at runtime — never bundle it.
  // @burgan-tech/vnext-schema is a plain CJS module and is bundled directly.
  // @burgan-tech/vnext-template is excluded because its init.js is executed as
  // a child process (needs to be a real file on disk in dist/vendor/).
  external: ['vscode', '@burgan-tech/vnext-template'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: !production,
  minify: production,
  alias: {
    '@handlers/project': path.resolve(__dirname, 'src/handlers/project'),
    '@handlers/workspace': path.resolve(__dirname, 'src/handlers/workspace'),
    '@handlers/validate': path.resolve(__dirname, 'src/handlers/validate'),
    '@handlers/template': path.resolve(__dirname, 'src/handlers/template'),
    '@handlers/runtime-proxy': path.resolve(__dirname, 'src/handlers/runtime-proxy'),
    '@ext/shared': path.resolve(__dirname, 'src/shared'),
  },
};

if (watch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log('[esbuild] watching...');
} else {
  await esbuild.build(buildOptions);
  console.log('[esbuild] build complete');
}
