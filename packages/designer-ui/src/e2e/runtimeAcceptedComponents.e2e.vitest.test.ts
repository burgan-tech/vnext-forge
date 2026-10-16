/**
 * E2E guard (opt-in): Forge's design-time mirrors of the runtime's publish
 * rules must not flag components the runtime accepted. Point
 * `E2E_EXAMPLE_ROOT` at a vnext-example checkout whose components were just
 * published to a local runtime (the integration suites publish them), e.g.
 *
 *   E2E_EXAMPLE_ROOT=../vnext-example pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/e2e
 *
 * Skipped when the variable is unset, so CI and normal `vitest run` ignore it.
 * See docs/testing/e2e.md.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { historyNoneIssues } from '@vnext-forge-studio/vnext-types';

import { computedIssues } from '../modules/schema-editor/model/computedRules';
import { fieldProtectionIssues } from '../modules/schema-editor/model/fieldProtection';
import { classifySchemaType, roleKeywordViolation } from '../modules/schema-editor/model/schemaRoles';
import { storageIssues } from '../modules/schema-editor/model/storageRules';

const ROOT = process.env.E2E_EXAMPLE_ROOT;

/** Fixtures that exist to be refused or to fault at runtime; they are not "accepted". */
const DELIBERATELY_INVALID = new Set(['hn-stuck']);

function jsonFiles(dir: string): string[] {
  try {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? jsonFiles(path) : path.endsWith('.json') ? [path] : [];
    });
  } catch {
    return [];
  }
}

function read(path: string): Record<string, unknown> | null {
  try {
    const json: unknown = JSON.parse(readFileSync(path, 'utf8'));
    return json && typeof json === 'object' && !Array.isArray(json) ? (json as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

type Node = Record<string, unknown>;

describe.skipIf(!ROOT)('runtime-accepted components (E2E_EXAMPLE_ROOT)', () => {
  it('raise no Forge rule-mirror findings', () => {
    const findings: string[] = [];
    const seen: Record<string, number> = {};

    for (const path of jsonFiles(join(ROOT!, 'core/Schemas'))) {
      const json = read(path);
      const attributes = json?.attributes as Node | undefined;
      if (!json || !attributes || DELIBERATELY_INVALID.has(String(json.key))) continue;
      const type = classifySchemaType(attributes.type);
      const role = type.kind === 'role' ? type.role : undefined;
      const walk = (node: unknown, pointer: string): void => {
        if (!node || typeof node !== 'object' || Array.isArray(node)) return;
        const n = node as Node;
        for (const [key, value] of Object.entries(n)) {
          if (!key.startsWith('x-')) continue;
          seen[key] = (seen[key] ?? 0) + 1;
          const violation = roleKeywordViolation(role, key, value);
          if (violation) findings.push(`${String(json.key)}${pointer}: ${violation}`);
        }
        for (const issue of [
          ...computedIssues(json, pointer),
          ...storageIssues(json, pointer),
          ...fieldProtectionIssues(json, pointer, 'x-encryption'),
          ...fieldProtectionIssues(json, pointer, 'x-masking'),
        ]) {
          findings.push(`${String(json.key)}${pointer}: ${issue}`);
        }
        for (const [key, child] of Object.entries((n.properties as Node | undefined) ?? {})) walk(child, `${pointer}/properties/${key}`);
        if (n.items) walk(n.items, `${pointer}/items`);
      };
      walk(attributes.schema, '');
    }

    for (const path of jsonFiles(join(ROOT!, 'core/Workflows'))) {
      const json = read(path);
      if (!json || json.flow !== 'sys-flows' || DELIBERATELY_INVALID.has(String(json.key))) continue;
      const mode = ((json.attributes as Node | undefined)?.history as string | undefined) ?? 'full';
      seen[`workflow:${mode}`] = (seen[`workflow:${mode}`] ?? 0) + 1;
      for (const issue of historyNoneIssues(json)) findings.push(`${String(json.key)}: ${issue.code} ${issue.message}`);
    }

    console.log(`[e2e] checked ${JSON.stringify(seen)}`);
    expect(findings).toEqual([]);
  });
});
