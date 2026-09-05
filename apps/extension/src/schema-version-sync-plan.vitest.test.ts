import { describe, expect, it } from 'vitest';

import {
  describeMissingPackageJson,
  describeSchemaSyncAction,
  planSchemaVersionSync,
  type SchemaSyncSolutionInput,
} from './schema-version-sync-plan.js';

/** `null` = no package.json at all (an explicit `undefined` would fall back to the default). */
const core = (schemaVersion = '0.0.52', packageJsonPath: string | null = '/ws/package.json'): SchemaSyncSolutionInput => ({
  filePath: '/ws/vnext.config.json',
  fileName: 'vnext.config.json',
  rootPath: '/ws',
  domain: 'core',
  schemaVersion,
  ...(packageJsonPath ? { packageJsonPath } : {}),
});
const partner = (schemaVersion = '0.0.52', packageJsonPath: string | null = '/ws/package.json'): SchemaSyncSolutionInput => ({
  filePath: '/ws/vnext.partner.config.json',
  fileName: 'vnext.partner.config.json',
  rootPath: '/ws',
  domain: 'partner',
  schemaVersion,
  ...(packageJsonPath ? { packageJsonPath } : {}),
});

describe('planSchemaVersionSync', () => {
  it('only seeds on the first pass', () => {
    const plan = planSchemaVersionSync(new Map(), [core('0.0.52'), partner('0.0.53')], { seeded: false });
    expect(plan.actions).toEqual([]);
    expect([...plan.nextLastKnown.entries()]).toEqual([
      ['/ws/vnext.config.json', '0.0.52'],
      ['/ws/vnext.partner.config.json', '0.0.53'],
    ]);
  });

  it('seeds a newly discovered file without acting on it', () => {
    const last = new Map([['/ws/vnext.config.json', '0.0.52']]);
    const plan = planSchemaVersionSync(last, [core(), partner('0.0.99')], { seeded: true });
    expect(plan.actions).toEqual([]);
    expect(plan.nextLastKnown.get('/ws/vnext.partner.config.json')).toBe('0.0.99');
  });

  it('drops deleted files from the snapshot', () => {
    const last = new Map([
      ['/ws/vnext.config.json', '0.0.52'],
      ['/ws/vnext.partner.config.json', '0.0.52'],
    ]);
    const plan = planSchemaVersionSync(last, [core()], { seeded: true });
    expect(plan.nextLastKnown.has('/ws/vnext.partner.config.json')).toBe(false);
  });

  it('emits one action per changed solution with from/to', () => {
    const last = new Map([
      ['/ws/vnext.config.json', '0.0.52'],
      ['/ws/vnext.partner.config.json', '0.0.52'],
    ]);
    const plan = planSchemaVersionSync(last, [core(), partner('0.0.53', '/ws/partner/package.json')], { seeded: true });
    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0]).toMatchObject({
      domain: 'partner',
      from: '0.0.52',
      to: '0.0.53',
      packageJsonPath: '/ws/partner/package.json',
      sharedWith: [],
    });
  });

  it('de-duplicates per package.json directory and reports the shared domains', () => {
    const last = new Map([
      ['/ws/vnext.config.json', '0.0.52'],
      ['/ws/vnext.partner.config.json', '0.0.52'],
    ]);
    const plan = planSchemaVersionSync(last, [core('0.0.53'), partner('0.0.54')], { seeded: true });
    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0].domain).toBe('core');
    expect(plan.actions[0].sharedWith).toEqual(['partner']);
  });

  it('keeps an action without package.json so the controller can warn', () => {
    const last = new Map([['/ws/vnext.config.json', '0.0.52']]);
    const plan = planSchemaVersionSync(last, [core('0.0.53', null)], { seeded: true });
    expect(plan.actions[0].packageJsonPath).toBeUndefined();
  });

  it('normalises Windows separators in keys', () => {
    const last = new Map([['/ws/vnext.config.json', '0.0.52']]);
    const plan = planSchemaVersionSync(last, [{ ...core('0.0.53'), filePath: '\\ws\\vnext.config.json' }], { seeded: true });
    expect(plan.actions).toHaveLength(1);
  });
});

describe('notification copy', () => {
  it('describes an applied action, with the shared-package note only when needed', () => {
    const action = planSchemaVersionSync(
      new Map([['/ws/vnext.partner.config.json', '0.0.52']]),
      [partner('0.0.53', '/ws/partner/package.json')],
      { seeded: true },
    ).actions[0];
    expect(describeSchemaSyncAction(action, 'partner/package.json')).toBe(
      'vNext Forge: schemaVersion is now 0.0.53 in vnext.partner.config.json. Updated partner/package.json and started "npm install" in the Forge terminal.',
    );
    expect(describeSchemaSyncAction({ ...action, sharedWith: ['core'] }, 'package.json')).toContain(
      'Note: this package.json is shared with domain(s) core, which pin a different schemaVersion.',
    );
    expect(describeMissingPackageJson(action, 'partner')).toBe(
      'vNext Forge: schemaVersion changed in vnext.partner.config.json, but no package.json was found (partner/package.json or package.json). Update @burgan-tech/vnext-schema manually.',
    );
  });
});
