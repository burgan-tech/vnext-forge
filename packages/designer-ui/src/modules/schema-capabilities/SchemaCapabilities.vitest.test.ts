import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

import { deriveSchemaCapabilities, hasFeature } from './SchemaCapabilities';

const require_ = createRequire(import.meta.url);
const vnextSchema = require_('@burgan-tech/vnext-schema') as { getSchema(type: string): Record<string, unknown> };

describe('SchemaCapabilities — runtime 0.0.99 constructs in the bundled schema', () => {
  const workflow = deriveSchemaCapabilities(vnextSchema.getSchema('workflow'));

  it('detects the optional Initial state', () => {
    expect(workflow.initialStateOptional).toBe(true);
  });

  it('detects executionType, variableKey and role-grant combinators', () => {
    expect(hasFeature(workflow, 'attributes.executionType')).toBe(true);
    expect(hasFeature(workflow, 'definitions.transition.executionType')).toBe(true);
    expect(hasFeature(workflow, 'definitions.onExecuteTask.variableKey')).toBe(true);
    expect(hasFeature(workflow, 'definitions.roleGrant.allOf')).toBe(true);
  });

  it('treats a schema that requires one Initial as not optional', () => {
    const legacy = deriveSchemaCapabilities({
      properties: { attributes: { properties: { states: { contains: {}, minContains: 1 } } } },
    });
    expect(legacy.initialStateOptional).toBe(false);
  });
});
