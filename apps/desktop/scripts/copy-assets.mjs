/**
 * Copies the production web app build from apps/web/dist/ into
 * apps/desktop/dist/webview/ so electron-builder can include it in the
 * installer without the full monorepo source being present.
 *
 * Run after esbuild.desktop.mjs as part of the `build` script.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, '..');
const monorepoRoot = path.resolve(desktopRoot, '..', '..');

const src = path.join(monorepoRoot, 'apps', 'web', 'dist');
const dest = path.join(desktopRoot, 'dist', 'webview');

if (!fs.existsSync(src)) {
  console.error(`[copy-assets] web app dist not found at ${src}`);
  console.error('[copy-assets] Run `pnpm --filter @vnext-forge/web build` first.');
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true, dereference: true });
console.log(`[copy-assets] web app copied → dist/webview/`);
