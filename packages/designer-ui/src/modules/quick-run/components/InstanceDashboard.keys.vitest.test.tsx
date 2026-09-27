import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The dashboard remounts a few per-instance panels by keying them on the
// active instance id. They are siblings under the same <main>, so the keys
// must differ: two siblings sharing a key make React leave orphaned DOM nodes
// behind on re-render (the incident alert stacked up once per update).
const source = readFileSync(fileURLToPath(new URL('./InstanceDashboard.tsx', import.meta.url)), 'utf8');

describe('InstanceDashboard instance-scoped keys', () => {
  it('gives every panel keyed on the active instance a distinct key', () => {
    const keys = [...source.matchAll(/key=\{([^}]*activeTabId[^}]*)\}/g)].map((m) => m[1].trim());
    expect(keys.length).toBeGreaterThanOrEqual(2);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
