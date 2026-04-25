#!/usr/bin/env node
/**
 * One-off / local helper: moves legacy flat registry fixture files
 * (`files.read.json`) into nested paths (`fixtures/files/read.json`).
 *
 * Usage: node scripts/migrate-registry-fixtures.mjs
 */

import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const fixturesDir = path.join(root, 'packages', 'services-core', 'test', 'fixtures');

const moves = [
  { from: ['files.read.json'], to: ['files', 'read.json'] },
  { from: ['projects.list.json'], to: ['projects', 'list.json'] },
  { from: ['runtime.proxy.json'], to: ['runtime', 'proxy.json'] },
];

for (const { from, to } of moves) {
  const src = path.join(fixturesDir, ...from);
  const dest = path.join(fixturesDir, ...to);
  if (!existsSync(src)) continue;
  mkdirSync(path.dirname(dest), { recursive: true });
  if (existsSync(dest)) {
    unlinkSync(src);
    continue;
  }
  renameSync(src, dest);
}
