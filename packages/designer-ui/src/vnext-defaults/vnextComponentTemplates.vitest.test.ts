import { createRequire } from 'node:module';

import Ajv from 'ajv';
import Ajv2019 from 'ajv/dist/2019.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

import { buildVnextComponentJson } from './vnextComponentTemplates.js';
import type { VnextComponentType } from '../../shared/projectTypes.js';

const requireCjs = createRequire(import.meta.url);
const vnextSchema = requireCjs('@burgan-tech/vnext-schema') as {
  getSchema(type: string): Record<string, unknown> | null;
};

function getAjvFor(schema: Record<string, unknown>): Ajv {
  const draft = (schema.$schema as string) ?? '';
  const ajvOpts = { strict: false, allErrors: true, verbose: true };
  if (draft.includes('2019-09')) {
    const ajv = new Ajv2019(ajvOpts);
    addFormats(ajv as unknown as Ajv);
    return ajv as unknown as Ajv;
  }
  const ajv = new Ajv(ajvOpts);
  addFormats(ajv);
  return ajv;
}

const SIX: VnextComponentType[] = [
  'workflow',
  'task',
  'schema',
  'view',
  'function',
  'extension',
];

describe('buildVnextComponentJson vs @burgan-tech/vnext-schema', () => {
  for (const kind of SIX) {
    it(`produces a document that validates for schema type "${kind}"`, () => {
      const schema = vnextSchema.getSchema(kind);
      if (!schema) {
        throw new Error(`vnext-schema has no getSchema("${kind}")`);
      }
      const ajv = getAjvFor(schema);
      const validate = ajv.compile(schema);
      const doc = buildVnextComponentJson(kind, { key: 'test-key', domain: 'test-domain' });
      const valid = validate(doc);
      if (!valid) {
        // eslint-disable-next-line no-console
        console.error(validate.errors);
      }
      expect(valid).toBe(true);
    });
  }
});
