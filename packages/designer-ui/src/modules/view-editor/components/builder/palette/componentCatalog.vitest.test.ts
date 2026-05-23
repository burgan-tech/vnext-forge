import { describe, expect, it } from 'vitest';

import { getComponentMeta, listComponentTypes } from '@burgantech/pseudo-ui';

import { COMPONENT_CATALOG, createNodeFromCatalog, findComponentMeta } from './componentCatalog';

describe('componentCatalog', () => {
  it('every SDK-listed component type has a catalog entry', () => {
    const sdkTypes = listComponentTypes();
    const catalogTypes = new Set(COMPONENT_CATALOG.map((c) => c.type));
    const missing = sdkTypes.filter((t) => !catalogTypes.has(t));
    expect(missing).toEqual([]);
  });

  it('every catalog entry has its structural metadata sourced from the SDK', () => {
    for (const meta of COMPONENT_CATALOG) {
      const sdk = getComponentMeta(meta.type);
      // We allow extra catalog entries the SDK doesn't know about (would warn
      // at module load), but every type the SDK *does* know should mirror its
      // structural fields.
      if (sdk) {
        expect(meta.acceptsChildren).toBe(sdk.acceptsChildren);
        if (sdk.childContainerKey) {
          expect(meta.childContainerKey).toBe(sdk.childContainerKey);
        }
      }
    }
  });

  it('every entry has the required UI metadata fields', () => {
    for (const meta of COMPONENT_CATALOG) {
      expect(meta.type).toBeTruthy();
      expect(meta.category).toBeTruthy();
      expect(meta.label).toBeTruthy();
      expect(meta.iconName).toBeTruthy();
      expect(meta.defaultProps.type).toBe(meta.type);
      if (meta.acceptsChildren) {
        expect(meta.childContainerKey).toBeTruthy();
      }
    }
  });

  it('createNodeFromCatalog produces a node whose type matches the catalog entry', () => {
    for (const meta of COMPONENT_CATALOG) {
      const node = createNodeFromCatalog(meta.type);
      expect(node.type).toBe(meta.type);
    }
  });

  it('findComponentMeta returns undefined for unknown types', () => {
    expect(findComponentMeta('NotARealComponent')).toBeUndefined();
  });
});
