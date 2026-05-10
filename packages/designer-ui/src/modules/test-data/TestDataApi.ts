import { unwrapApi } from '../../api/client.js';

import type {
  TestDataGenerateForComponentResult,
  TestDataGenerateOptions,
  TestDataGenerateResult,
} from './TestDataTypes.js';

/**
 * Thin wrappers over `test-data/*` registry endpoints. Mirrors the
 * convention used by every other designer-ui module (sessions, snippets,
 * git-hooks): `unwrapApi` + a typed result.
 */

export async function generateTestData(
  schema: Record<string, unknown>,
  options?: TestDataGenerateOptions,
): Promise<TestDataGenerateResult> {
  return unwrapApi<TestDataGenerateResult>({
    method: 'test-data/generate',
    params: { schema, ...(options ? { options } : {}) },
  });
}

export async function generateTestDataForSchemaComponent(args: {
  projectId: string;
  group: string;
  name: string;
  options?: TestDataGenerateOptions;
}): Promise<TestDataGenerateForComponentResult> {
  return unwrapApi<TestDataGenerateForComponentResult>({
    method: 'test-data/generateForSchemaComponent',
    params: {
      projectId: args.projectId,
      group: args.group,
      name: args.name,
      ...(args.options ? { options: args.options } : {}),
    },
  });
}
