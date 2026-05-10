/**
 * Generates app icons (icon.icns / icon.ico / icon.png) from the brand SVG.
 *
 * Source:  apps/web/public/icon-with-background.svg  (gradient + tools glyph)
 * Outputs: apps/desktop/build/icons/icon.icns        (macOS, multi-size)
 *          apps/desktop/build/icons/icon.ico         (Windows, multi-size)
 *          apps/desktop/build/icons/icon.png         (Linux, 512×512)
 *
 * Tooling:
 *   sharp        — SVG → PNG raster at high DPI (cross-platform, libvips bound)
 *   png-to-ico   — pure JS PNG → ICO multi-resolution writer (Windows)
 *   iconutil     — macOS-only, ships with Xcode CLT; bundles iconset → icns
 *
 * On Linux/Windows hosts iconutil isn't available; the icns step is skipped
 * with a warning. Mac/Win/Linux PNG and ICO are still produced.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, '..');
const monorepoRoot = path.resolve(desktopRoot, '..', '..');

const SOURCE_SVG = path.join(monorepoRoot, 'apps/web/public/icon-with-background.svg');
const ICONS_DIR = path.join(desktopRoot, 'build/icons');

// macOS iconset wants every retina + non-retina pair from 16 to 1024.
const MAC_SIZES = [16, 32, 64, 128, 256, 512, 1024];
// Windows multi-resolution ICO. 256 is the largest Explorer reads.
const WIN_SIZES = [16, 24, 32, 48, 64, 128, 256];
// Linux app icon.
const LINUX_SIZE = 512;

async function ensureCleanIconsDir() {
  await fs.rm(ICONS_DIR, { recursive: true, force: true });
  await fs.mkdir(ICONS_DIR, { recursive: true });
}

async function renderPng(svgBuffer, size, outputPath) {
  await sharp(svgBuffer, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outputPath);
}

async function buildMacIconset(svgBuffer) {
  const iconsetDir = path.join(ICONS_DIR, 'icon.iconset');
  await fs.mkdir(iconsetDir, { recursive: true });

  // Apple iconset filename convention: icon_<base>x<base>[@2x].png
  // So 1024×1024 lands as both icon_512x512@2x.png and icon_1024x1024.png.
  const fileNameFor = (size, isRetina) =>
    isRetina
      ? `icon_${size / 2}x${size / 2}@2x.png`
      : `icon_${size}x${size}.png`;

  const tasks = [];
  for (const size of MAC_SIZES) {
    tasks.push(renderPng(svgBuffer, size, path.join(iconsetDir, fileNameFor(size, false))));
    if (size <= 512) {
      tasks.push(
        renderPng(svgBuffer, size * 2, path.join(iconsetDir, fileNameFor(size * 2, true))),
      );
    }
  }
  await Promise.all(tasks);

  if (process.platform !== 'darwin') {
    console.warn(
      '[icons] iconutil only runs on macOS — icon.icns step skipped on this host.',
    );
    return;
  }

  const icnsPath = path.join(ICONS_DIR, 'icon.icns');
  await execFileAsync('iconutil', ['-c', 'icns', '-o', icnsPath, iconsetDir]);
  console.log(`[icons] wrote ${path.relative(monorepoRoot, icnsPath)}`);

  // Iconset folder is no longer needed once icns is built. Keep it on
  // non-darwin hosts so the user can post-process with another tool.
  await fs.rm(iconsetDir, { recursive: true, force: true });
}

async function buildWindowsIco(svgBuffer) {
  const tmpDir = await fs.mkdtemp(path.join(ICONS_DIR, 'win-tmp-'));
  try {
    const pngPaths = [];
    for (const size of WIN_SIZES) {
      const out = path.join(tmpDir, `${size}.png`);
      await renderPng(svgBuffer, size, out);
      pngPaths.push(out);
    }
    const icoBuffer = await pngToIco(pngPaths);
    const icoPath = path.join(ICONS_DIR, 'icon.ico');
    await fs.writeFile(icoPath, icoBuffer);
    console.log(`[icons] wrote ${path.relative(monorepoRoot, icoPath)}`);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

async function buildLinuxPng(svgBuffer) {
  const pngPath = path.join(ICONS_DIR, 'icon.png');
  await renderPng(svgBuffer, LINUX_SIZE, pngPath);
  console.log(`[icons] wrote ${path.relative(monorepoRoot, pngPath)}`);
}

async function main() {
  console.log(`[icons] source: ${path.relative(monorepoRoot, SOURCE_SVG)}`);
  const svgBuffer = await fs.readFile(SOURCE_SVG);

  await ensureCleanIconsDir();
  await Promise.all([
    buildMacIconset(svgBuffer),
    buildWindowsIco(svgBuffer),
    buildLinuxPng(svgBuffer),
  ]);

  console.log('[icons] done');
}

main().catch((err) => {
  console.error('[icons] failed:', err);
  process.exitCode = 1;
});
