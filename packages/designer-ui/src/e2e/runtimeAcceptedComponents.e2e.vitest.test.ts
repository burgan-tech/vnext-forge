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

import {
  historyNoneIssues,
  resourceLockIssues,
  rowSecurityIssues,
  scriptCallerIssues,
  transitionPriorityIssues,
  transitionSchemasIssues,
  validateAiAgentStates,
  type ScriptCallerSurface,
} from '@vnext-forge-studio/vnext-types';

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

const isNode = (v: unknown): v is Node => v !== null && typeof v === 'object' && !Array.isArray(v);
/** Rule-entry lists come as a plain array or wrapped (`{ views: [...] }`, `{ schemas: [...] }`). */
const entries = (v: unknown, wrapper: string): Node[] =>
  (Array.isArray(v) ? v : isNode(v) && Array.isArray(v[wrapper]) ? v[wrapper] : []).filter(isNode);

function decodeScript(script: unknown): string | null {
  if (!isNode(script) || typeof script.code !== 'string') return null;
  return script.encoding === 'NAT' ? script.code : Buffer.from(script.code, 'base64').toString('utf8');
}

/** Every inline script of a component with its runtime 0.0.105 caller surface (by JSON shape). */
function scriptsBySurface(json: Node): [ScriptCallerSurface, string, unknown][] {
  const out: [ScriptCallerSurface, string, unknown][] = [];
  const a = isNode(json.attributes) ? json.attributes : {};
  const tasks = (list: unknown, at: string, surface: ScriptCallerSurface) =>
    (Array.isArray(list) ? list : []).filter(isNode).forEach((t, i) => out.push([surface, `${at}[${i}].mapping`, t.mapping]));
  // `view` and `views` both take a rule-entry array or `{ views: [...] }` (runtime ViewDefinitionJsonConverter).
  const views = (owner: Node, at: string) =>
    (['view', 'views'] as const).forEach((field) =>
      entries(owner[field], 'views').forEach((e, i) => out.push(['viewRule', `${at}.${field}[${i}].rule`, e.rule])),
    );
  const transition = (t: unknown, at: string) => {
    if (!isNode(t)) return;
    out.push(['automaticRule', `${at}.rule`, t.rule ?? t.condition], ['timer', `${at}.timer`, t.timer], ['transitionMapping', `${at}.mapping`, t.mapping]);
    entries(t.schemas, 'schemas').forEach((e, i) => out.push(['transitionSchemaRule', `${at}.schemas[${i}].rule`, e.rule]));
    views(t, at);
    tasks(t.onExecutionTasks, `${at}.onExecutionTasks`, 'taskMapping');
    if (isNode(t.event)) out.push(['eventMapping', `${at}.event.mapping`, t.event.mapping]);
    if (isNode(t.resourceLock)) out.push(['resourceLock', `${at}.resourceLock.keyExpression`, t.resourceLock.keyExpression]);
  };
  if (json.flow === 'sys-flows') {
    for (const k of ['startTransition', 'cancel', 'exit', 'updateData', 'timeout']) transition(a[k], k);
    (Array.isArray(a.sharedTransitions) ? a.sharedTransitions : []).forEach((t, i) => transition(t, `sharedTransitions[${i}]`));
    (Array.isArray(a.states) ? a.states : []).filter(isNode).forEach((st) => {
      const at = `states.${String(st.key)}`;
      views(st, at);
      tasks(st.onEntries, `${at}.onEntries`, 'taskMapping');
      tasks(st.onExits, `${at}.onExits`, 'taskMapping');
      if (isNode(st.subFlow)) out.push(['subFlowMapping', `${at}.subFlow.mapping`, st.subFlow.mapping]);
      (Array.isArray(st.transitions) ? st.transitions : []).forEach((t, i) => transition(t, `${at}.transitions[${i}]`));
    });
  } else if (json.flow === 'sys-functions') {
    for (const k of ['inputSchema', 'outputSchema', 'inputView', 'outputView']) {
      if (Array.isArray(a[k])) (a[k] as unknown[]).filter(isNode).forEach((e, i) => out.push(['functionContractRule', `${k}[${i}].rule`, e.rule]));
    }
    if (isNode(a.task)) out.push(['taskMapping', 'task.mapping', a.task.mapping]);
    tasks(a.onExecutionTasks, 'onExecutionTasks', 'taskMapping');
  } else if (json.flow === 'sys-extensions' && isNode(a.task)) {
    out.push(['extension', 'task.mapping', a.task.mapping]);
  }
  return out;
}

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
      // Runtime 0.0.102+: only errors are publish rejections; warnings are log-only there too.
      for (const issue of [
        ...transitionPriorityIssues(json),
        ...transitionSchemasIssues(json),
        ...rowSecurityIssues(json),
        ...resourceLockIssues(json),
      ]) {
        if (issue.severity === 'error') findings.push(`${String(json.key)}: ${issue.code} ${issue.message}`);
      }
      // Runtime 0.0.105: AiAgent state publish checks (vnext#1105).
      for (const issue of validateAiAgentStates((json.attributes as Node | undefined)?.states)) {
        if (issue.severity === 'error') findings.push(`${String(json.key)}: ai-agent ${issue.message}`);
      }
    }

    // Runtime 0.0.105 `context.Caller`: a component whose suites pass never reads the caller where the
    // runtime has none. Unguarded reads and role-header parsing are style warnings, counted but allowed.
    for (const dir of ['core/Workflows', 'core/Functions', 'core/Extensions']) {
      for (const path of jsonFiles(join(ROOT!, dir))) {
        const json = read(path);
        if (!json || DELIBERATELY_INVALID.has(String(json.key))) continue;
        for (const [surface, at, script] of scriptsBySurface(json)) {
          const code = decodeScript(script);
          if (!code) continue;
          if (/\.\s*Caller\b/.test(code)) seen[`caller:${surface}`] = (seen[`caller:${surface}`] ?? 0) + 1;
          for (const issue of scriptCallerIssues(code, surface)) {
            seen[issue.code] = (seen[issue.code] ?? 0) + 1;
            if (issue.code === 'caller.unavailable') findings.push(`${String(json.key)} ${at}: ${issue.message}`);
          }
        }
      }
    }

    console.log(`[e2e] checked ${JSON.stringify(seen)}`);
    expect(findings).toEqual([]);
  });
});
