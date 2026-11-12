import { describe, expect, it } from 'vitest';

import { pythonTaskConfigRules } from './pythonTaskConfigRules.js';

describe('pythonTaskConfigRules', () => {
  it('accepts the handoff example', () => {
    const result = pythonTaskConfigRules({ handler: 'risk_score', input: { income: 85000 }, timeoutSeconds: 20 });
    expect(result).toEqual({ errors: {}, legacyKeys: [], unknownKeys: [] });
  });

  it('requires a handler matching the schema pattern', () => {
    expect(pythonTaskConfigRules({}).errors.handler).toMatch(/required/);
    expect(pythonTaskConfigRules({ handler: '9lives' }).errors.handler).toBeDefined();
    expect(pythonTaskConfigRules({ handler: 'pkg.mod-x_1' }).errors.handler).toBeUndefined();
    expect(pythonTaskConfigRules({ handler: `a${'b'.repeat(128)}` }).errors.handler).toBeDefined();
  });

  it('bounds timeoutSeconds to 1–50 whole seconds, absent allowed', () => {
    expect(pythonTaskConfigRules({ handler: 'h' }).errors.timeoutSeconds).toBeUndefined();
    for (const bad of [0, 51, 2.5, '10']) {
      expect(pythonTaskConfigRules({ handler: 'h', timeoutSeconds: bad }).errors.timeoutSeconds).toBeDefined();
    }
    expect(pythonTaskConfigRules({ handler: 'h', timeoutSeconds: 50 }).errors.timeoutSeconds).toBeUndefined();
  });

  it('flags the legacy inline-script shape as needing migration', () => {
    const result = pythonTaskConfigRules({ handler: 'h', script: { code: 'x' }, executionMode: 'inline' });
    expect(result.legacyKeys).toEqual(['script', 'executionMode']);
    expect(result.errors.config).toMatch(/rejects it at publish/);
  });

  it('reports other keys the closed config rejects', () => {
    expect(pythonTaskConfigRules({ handler: 'h', foo: 1 }).unknownKeys).toEqual(['foo']);
  });
});
