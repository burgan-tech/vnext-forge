import type { DiscoveredVnextComponent } from '@vnext-forge-studio/app-contracts';
import { describe, expect, it } from 'vitest';

import { loadSchemaComponent, readSchemaReference, type SchemaComponentLoaderDeps } from './loadSchemaComponent';

const LIST: DiscoveredVnextComponent[] = [
  { key: 'orders', path: '/p/partner/Schemas/orders.json', flow: 'sys-schemas', domain: 'partner' },
  { key: 'orders', path: '/p/core/Schemas/orders.json', flow: 'sys-schemas', domain: 'core' },
  { key: 'broken', path: '/p/core/Schemas/broken.json', flow: 'sys-schemas', domain: 'core' },
];
const FILES: Record<string, string> = {
  '/p/partner/Schemas/orders.json': JSON.stringify({ key: 'orders', domain: 'partner' }),
  '/p/core/Schemas/orders.json': JSON.stringify({ key: 'orders', domain: 'core' }),
  '/p/core/Schemas/broken.json': '{ not json',
};
const deps: SchemaComponentLoaderDeps = {
  listSchemas: () => Promise.resolve(LIST),
  readText: (path) => {
    const content = FILES[path];
    return content === undefined ? Promise.reject(new Error('missing')) : Promise.resolve(content);
  },
};

describe('readSchemaReference', () => {
  it('reads key, domain, version and flow', () => {
    expect(readSchemaReference({ key: 'orders', domain: 'core', version: '1.0.0', flow: 'sys-schemas' })).toEqual({
      key: 'orders',
      domain: 'core',
      version: '1.0.0',
      flow: 'sys-schemas',
    });
  });

  it('returns null without a key', () => {
    expect(readSchemaReference({ domain: 'core' })).toBeNull();
    expect(readSchemaReference({ key: '  ' })).toBeNull();
    expect(readSchemaReference('orders')).toBeNull();
    expect(readSchemaReference(undefined)).toBeNull();
  });
});

describe('loadSchemaComponent', () => {
  it('prefers the component of the referenced domain', async () => {
    expect(await loadSchemaComponent('core', { key: 'orders', domain: 'core' }, deps)).toEqual({
      key: 'orders',
      domain: 'core',
    });
  });

  it('falls back to the first component with the key', async () => {
    expect(await loadSchemaComponent('core', { key: 'orders' }, deps)).toEqual({ key: 'orders', domain: 'partner' });
  });

  it('returns null for unknown keys and unreadable files', async () => {
    expect(await loadSchemaComponent('core', { key: 'ghost' }, deps)).toBeNull();
    expect(await loadSchemaComponent('core', { key: 'broken' }, deps)).toBeNull();
  });
});
