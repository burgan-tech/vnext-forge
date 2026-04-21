/**
 * designer-ui outline + component-badges SVG'lerini birleştirip VS Code
 * `WebviewPanel.iconPath` için `media/component-tab-icons/*.svg` üretir.
 * Tek kaynak: packages/designer-ui/src/assets/icons/
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const duIcons = path.join(repoRoot, 'packages/designer-ui/src/assets/icons');
const outlinePath = path.join(duIcons, 'component-file/outline.svg');
const outDir = path.join(repoRoot, 'apps/extension/media/component-tab-icons');

const BADGE_FILES = {
  workflow: 'workflow.svg',
  task: 'task.svg',
  schema: 'schema.svg',
  view: 'view.svg',
  function: 'function.svg',
  extension: 'extension.svg',
};

function stripSvgWrapper(svg) {
  return svg
    .replace(/<\?xml[^?]*\?>/gi, '')
    .replace(/<svg\b[^>]*>/i, '')
    .replace(/<\/svg>\s*$/i, '')
    .trim();
}

/** outline.svg stroke'ları dış <svg> üzerinde; VS Code sekmesinde görünür kalsın diye <g> ile taşınır */
const outlineInner = `<g stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${stripSvgWrapper(fs.readFileSync(outlinePath, 'utf8'))}</g>`;

fs.mkdirSync(outDir, { recursive: true });

for (const [kind, badgeName] of Object.entries(BADGE_FILES)) {
  const badgePath = path.join(duIcons, 'component-badges', badgeName);
  const badgeInner = stripSvgWrapper(fs.readFileSync(badgePath, 'utf8'));
  const combined = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
${outlineInner}
${badgeInner}
</svg>
`;
  fs.writeFileSync(path.join(outDir, `${kind}.svg`), combined);
}

console.log('[sync-component-tab-icons] wrote', Object.keys(BADGE_FILES).length, 'icons to', outDir);
