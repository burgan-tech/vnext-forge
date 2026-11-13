#!/usr/bin/env node
/**
 * Resolves the version the VS Code extension is published with and writes it
 * to apps/extension/package.json (working tree only — CI never commits it).
 *
 * version = max(package.json version, latest Marketplace version + 1 patch)
 *
 * So a merge to main always yields a publishable version, and a manual
 * minor/major bump in package.json still wins.
 *
 * Usage: node scripts/resolve-extension-version.mjs [--dry-run]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const manifestPath = fileURLToPath(new URL('../apps/extension/package.json', import.meta.url));
const dryRun = process.argv.includes('--dry-run');

const parse = (v) => {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
  if (!m) throw new Error(`Unsupported version "${v}" (expected x.y.z)`);
  return m.slice(1).map(Number);
};
const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

async function latestPublished(extensionId) {
  const res = await fetch(
    'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery',
    {
      method: 'POST',
      headers: {
        Accept: 'application/json;api-version=7.2-preview.1',
        'Content-Type': 'application/json',
      },
      // filterType 7 = extension name, flags 1 = include versions
      body: JSON.stringify({
        filters: [{ criteria: [{ filterType: 7, value: extensionId }] }],
        flags: 1,
      }),
    },
  );
  if (!res.ok) throw new Error(`Marketplace query failed: HTTP ${res.status}`);
  const body = await res.json();
  const extension = body.results?.[0]?.extensions?.[0];
  if (!extension) return null; // never published
  return extension.versions
    .map((v) => parse(v.version))
    .sort(compare)
    .at(-1);
}

const raw = readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(raw);
const local = parse(manifest.version);
const published = await latestPublished(`${manifest.publisher}.${manifest.name}`);

let next = local;
if (published && compare(local, published) <= 0) {
  next = [published[0], published[1], published[2] + 1];
}
const version = next.join('.');

if (!dryRun && version !== manifest.version) {
  // Targeted replace keeps the file's formatting intact.
  const updated = raw.replace(
    /("version"\s*:\s*")[^"]+(")/,
    (_, open, close) => `${open}${version}${close}`,
  );
  writeFileSync(manifestPath, updated);
}

console.error(
  `package.json: ${manifest.version} | marketplace: ${published?.join('.') ?? 'none'} | publishing: ${version}`,
);
console.log(version);
