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
  config: 'settings.svg',
};

function stripSvgWrapper(svg) {
  return svg
    .replace(/<\?xml[^?]*\?>/gi, '')
    .replace(/<svg\b[^>]*>/i, '')
    .replace(/<\/svg>\s*$/i, '')
    .trim();
}

/**
 * outline.svg stroke'ları dış <svg> üzerinde; VS Code tab ikonları
 * `currentColor` substitution YAPMIYOR — SVG'yi olduğu gibi renderliyor.
 * Bu yüzden sabit renkli iki varyant üretiyoruz:
 *   - light: koyu kontur (light tema sekme metni rengi)
 *   - dark : açık kontur (dark / high-contrast tema sekme metni rengi)
 * `DesignerPanel.iconPath` { light, dark } objesi ile bu varyantları kullanır.
 */
const OUTLINE_STROKE = {
  light: '#424242',
  dark: '#cccccc',
};

const outlineRaw = stripSvgWrapper(fs.readFileSync(outlinePath, 'utf8'));

function buildOutlineGroup(stroke) {
  return `<g stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none">${outlineRaw}</g>`;
}

fs.mkdirSync(outDir, { recursive: true });

let written = 0;

for (const [kind, badgeName] of Object.entries(BADGE_FILES)) {
  const badgePath = path.join(duIcons, 'component-badges', badgeName);
  const badgeInner = stripSvgWrapper(fs.readFileSync(badgePath, 'utf8'));

  for (const [variant, stroke] of Object.entries(OUTLINE_STROKE)) {
    const combined = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
${buildOutlineGroup(stroke)}
${badgeInner}
</svg>
`;
    fs.writeFileSync(path.join(outDir, `${kind}-${variant}.svg`), combined);
    written++;
  }
}

console.log('[sync-component-tab-icons] wrote', written, 'icon files to', outDir);
