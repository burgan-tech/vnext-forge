/**
 * Tek kaynak: packages/designer-ui/src/assets/icons/
 *
 * VS Code `WebviewPanel.iconPath` yalnizca uzanti paketi icindeki dosya URI'lerini
 * kabul eder; bu betik outline + component-badges birlesimini `media/component-tab-icons/`
 * altina yazar. Kaynak SVG'ler designer-ui'da tutulur; media ciktisi build artefaktidir
 * (`npm run build:host` oncesi `sync-tab-icons` calisir).
 *
 * Tab ikonlari "dolgulu file ikonu + ic rozet" olarak Explorer ile birebir ayni
 * goruntude basilir; folder paletinin light ve dark varyantlari kullanilir.
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

/**
 * Dosya turu -> klasor paleti turu (Explorer ile aynidir; designer-ui
 * folderIconTheme.ts ile elle senkron tutulur).
 */
const FILE_TO_FOLDER = {
  workflow: 'workflows',
  task: 'tasks',
  schema: 'schemas',
  view: 'views',
  function: 'functions',
  extension: 'extensions',
  config: 'components_root',
};

/** packages/designer-ui/src/modules/component-icons/folderIconTheme.ts ile birebir senkron. */
const VNEXT_PALETTE = {
  workflows: {
    light: { fill: '#7C3AED', stroke: '#3B0764', badge: '#F5F3FF' },
    dark: { fill: '#8B5CF6', stroke: '#EDE9FE', badge: '#FAF5FF' },
  },
  tasks: {
    light: { fill: '#EA580C', stroke: '#7C2D12', badge: '#FFEDD5' },
    dark: { fill: '#FB923C', stroke: '#FFEDD5', badge: '#FFF7ED' },
  },
  schemas: {
    light: { fill: '#0E7490', stroke: '#134E4A', badge: '#ECFEFF' },
    dark: { fill: '#22D3EE', stroke: '#CFFAFE', badge: '#F0FDFF' },
  },
  views: {
    light: { fill: '#16A34A', stroke: '#14532D', badge: '#DCFCE7' },
    dark: { fill: '#4ADE80', stroke: '#DCFCE7', badge: '#F0FDF4' },
  },
  functions: {
    light: { fill: '#2563EB', stroke: '#1E3A8A', badge: '#DBEAFE' },
    dark: { fill: '#60A5FA', stroke: '#DBEAFE', badge: '#EFF6FF' },
  },
  extensions: {
    light: { fill: '#E11D48', stroke: '#831843', badge: '#FFE4E6' },
    dark: { fill: '#FB7185', stroke: '#FFE4E6', badge: '#FFF1F2' },
  },
  components_root: {
    light: { fill: '#9333EA', stroke: '#581C87', badge: '#FAE8FF' },
    dark: { fill: '#C084FC', stroke: '#F3E8FF', badge: '#FAF5FF' },
  },
};

function stripSvgWrapper(svg) {
  return svg
    .replace(/<\?xml[^?]*\?>/gi, '')
    .replace(/<svg\b[^>]*>/i, '')
    .replace(/<\/svg>\s*$/i, '')
    .trim();
}

const outlineRaw = stripSvgWrapper(fs.readFileSync(outlinePath, 'utf8'));

function applyFileVars(svgText, { fill, stroke }) {
  return svgText
    .replace(/var\(--file-fill,\s*[^)]+\)/g, fill)
    .replace(/var\(--file-stroke,\s*[^)]+\)/g, stroke);
}

fs.mkdirSync(outDir, { recursive: true });

let written = 0;

for (const [kind, badgeName] of Object.entries(BADGE_FILES)) {
  const folderKey = FILE_TO_FOLDER[kind];
  const palette = VNEXT_PALETTE[folderKey];
  const badgePath = path.join(duIcons, 'component-badges', badgeName);
  const badgeRaw = stripSvgWrapper(fs.readFileSync(badgePath, 'utf8'));

  for (const variant of /** @type {const} */ (['light', 'dark'])) {
    const colors = palette[variant];
    const outline = applyFileVars(outlineRaw, colors);
    const colorizedBadge = badgeRaw.replace(/currentColor/g, colors.badge);

    const combined = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
${outline}
${colorizedBadge}
</svg>
`;
    fs.writeFileSync(path.join(outDir, `${kind}-${variant}.svg`), combined);
    written++;
  }
}

console.log('[sync-component-tab-icons] wrote', written, 'icon files to', outDir);
