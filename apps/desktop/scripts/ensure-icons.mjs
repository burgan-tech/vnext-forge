/**
 * Idempotent icon generator. Runs as part of the build pipeline.
 *
 * - Skips if all three platform icons (icon.icns / icon.ico / icon.png) are
 *   already present in apps/desktop/build/icons/.
 * - Otherwise re-runs generate-icons.mjs to render them from the brand SVG.
 *
 * The build/ directory is git-ignored at the repo root (build artefacts), so
 * desktop icons are not checked in. This script makes a fresh checkout build
 * cleanly without any extra setup.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, '..');
const iconsDir = path.join(desktopRoot, 'build/icons');

const expected = ['icon.icns', 'icon.ico', 'icon.png'];

const allPresent = expected.every((file) => fs.existsSync(path.join(iconsDir, file)));

if (allPresent) {
  console.log('[icons] all platform icons already present, skipping');
  process.exit(0);
}

console.log('[icons] missing one or more platform icons, generating from SVG');
const generator = path.join(__dirname, 'generate-icons.mjs');
const result = spawnSync(process.execPath, [generator], { stdio: 'inherit' });
process.exit(result.status ?? 1);
