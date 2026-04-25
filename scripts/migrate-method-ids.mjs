#!/usr/bin/env node
/**
 * Rewrites legacy dotted RPC method ids (`files.read`) to slash ids (`files/read`)
 * in TypeScript / TSX sources. Intended for designer-ui / web / server call sites after
 * the registry key migration.
 *
 * ## Scanned paths
 * - `packages/designer-ui/src/**`
 * - `apps/web/src/**`
 * - `apps/server/src/**`
 * - Files: `*.ts` (excluding `*.d.ts`), `*.tsx`
 *
 * ## Patterns replaced (string literals only)
 * - `method: 'domain.action'` → `method: 'domain/action'` (same for double quotes)
 * - Applies anywhere that substring appears (e.g. `callApi({ method: '…' })`,
 *   `unwrapApi(...)` call sites are unchanged — they take `Response`; but
 *   `{ method: 'x.y', params }` objects are covered by the same `method:` rule).
 *
 * ## Not handled (run a repo-wide search after migrating)
 * - Method ids already using slashes (`files/read`)
 * - Template literals: `` method: `${foo}.bar` ``
 * - Non-literal keys or dynamic method strings
 * - `apps/extension/**` (skipped entirely — extension host parity contract)
 * - Docs, JSON fixtures, this script, and other non-`ts`/`tsx` files
 *
 * ## Usage
 *   node scripts/migrate-method-ids.mjs --dry    # print changes only
 *   node scripts/migrate-method-ids.mjs          # apply in place
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const dryRun = process.argv.includes('--dry');

const scanRoots = [
  path.join(root, 'packages', 'designer-ui', 'src'),
  path.join(root, 'apps', 'web', 'src'),
  path.join(root, 'apps', 'server', 'src'),
];

/** Dotted logical method id after `method:` (excludes HTTP verbs like GET). */
const METHOD_DOTTED_RE = /method:\s*['"]([a-z][a-zA-Z0-9]*)\.([a-zA-Z0-9]+)['"]/g;

function walkSourceFiles(dir, out = []) {
  let rootStat;
  try {
    rootStat = statSync(dir);
  } catch {
    return out;
  }
  if (!rootStat.isDirectory()) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkSourceFiles(full, out);
    } else if (
      name.endsWith('.tsx') ||
      (name.endsWith('.ts') && !name.endsWith('.d.ts'))
    ) {
      out.push(full);
    }
  }
  return out;
}

function shouldSkip(filePath) {
  const rel = path.relative(root, filePath).replaceAll('\\', '/');
  return rel.startsWith('apps/extension/');
}

function migrateContent(text) {
  return text.replace(METHOD_DOTTED_RE, "method: '$1/$2'");
}

let changedFiles = 0;

for (const scanRoot of scanRoots) {
  const files = walkSourceFiles(scanRoot);
  for (const filePath of files) {
    if (shouldSkip(filePath)) continue;
    const before = readFileSync(filePath, 'utf8');
    const after = migrateContent(before);
    if (before === after) continue;
    changedFiles += 1;
    if (dryRun) {
      process.stdout.write(`${path.relative(root, filePath)}\n`);
    } else {
      writeFileSync(filePath, after, 'utf8');
    }
  }
}

process.stdout.write(
  dryRun ? `[dry-run] ${changedFiles} file(s) would change\n` : `Updated ${changedFiles} file(s)\n`,
);
