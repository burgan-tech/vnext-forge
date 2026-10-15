/**
 * Design-time mirror of the runtime's `x-computed` publish rules for
 * `evaluatedBy: "runtime"` (runtime 0.0.100, vnext-docs
 * `schema-definition.md#x-computed`). `evaluatedBy: "client"` is the client's
 * contract: the runtime checks only the `evaluatedBy` value.
 */
import { parentPointer, parsePointer, type JsonPointer } from './jsonPointer';
import { getNodeAt, type SchemaNode } from './schemaNode';

export const COMPUTED_ARITHMETIC_OPS = ['add', 'subtract', 'multiply', 'divide'] as const;
export type ComputedArithmeticOp = (typeof COMPUTED_ARITHMETIC_OPS)[number];

/** Keywords a runtime-computed (never stored) field cannot carry. */
const STORED_ONLY = ['x-indexed', 'x-filterOperators', 'x-sortable', 'x-storage', 'x-roles', 'x-masking'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isAtRestEncrypted(node: unknown): boolean {
  if (!isRecord(node)) return false;
  const enc = node['x-encryption'];
  return isRecord(enc) && enc.source !== 'client' && (enc.type === 'hash' || enc.type === 'encrypt');
}

export function isRuntimeComputed(node: unknown): boolean {
  if (!isRecord(node)) return false;
  const computed = node['x-computed'];
  return isRecord(computed) && computed.evaluatedBy !== 'client';
}

/** Property names next to the field at `pointer` (the computed field's own object). */
export function computedSiblings(componentJson: Record<string, unknown> | null | undefined, pointer: JsonPointer): string[] {
  const segments = parsePointer(pointer);
  if (segments.length < 2 || segments[segments.length - 2] !== 'properties') return [];
  const self = segments[segments.length - 1]!;
  const parent = getNodeAt(componentJson ?? null, parentPointer(parentPointer(pointer) ?? '') ?? '');
  return parent && isRecord(parent.properties) ? Object.keys(parent.properties).filter((key) => key !== self) : [];
}

/** Problems of one `join` / `arithmetic` operation (`at` names it in messages). */
function operationIssues(
  operation: unknown,
  at: string,
  siblings: ReadonlyMap<string, SchemaNode>,
): string[] {
  if (!isRecord(operation)) return [`${at} must declare exactly one of 'join' or 'arithmetic'.`];
  const kinds = ['join', 'arithmetic'].filter((kind) => operation[kind] !== undefined);
  if (kinds.length !== 1) return [`${at} must declare exactly one of 'join' or 'arithmetic'.`];
  const kind = kinds[0]!;
  const body = operation[kind];
  const issues: string[] = [];
  const fields = isRecord(body) && Array.isArray(body.fields) ? body.fields : [];
  if (kind === 'arithmetic') {
    const op = isRecord(body) ? body.op : undefined;
    if (!(COMPUTED_ARITHMETIC_OPS as readonly unknown[]).includes(op)) {
      issues.push(`${at}.arithmetic.op must be 'add', 'subtract', 'multiply' or 'divide'.`);
    }
    if (fields.length < 2) issues.push(`${at}.arithmetic needs at least two fields.`);
  } else if (fields.length < 1) {
    issues.push(`${at}.join needs at least one field.`);
  }
  for (const field of fields) {
    if (typeof field !== 'string' || field.trim() === '') continue;
    const head = field.split('.')[0]!;
    const sibling = siblings.get(head);
    if (!sibling) {
      issues.push(`${at}.${kind} references '${field}', which is not a property of the same object.`);
    } else if (isRuntimeComputed(sibling)) {
      issues.push(`${at}.${kind} references '${field}', which is itself a runtime computed field; computed fields do not chain.`);
    } else if (isAtRestEncrypted(sibling)) {
      issues.push(`${at}.${kind} references '${field}', which is encrypted at rest.`);
    }
  }
  return issues;
}

/** Why the runtime would reject the `x-computed` at `pointer`; empty when fine or absent. */
export function computedIssues(componentJson: Record<string, unknown> | null | undefined, pointer: JsonPointer): string[] {
  if (!componentJson) return [];
  const node = getNodeAt(componentJson, pointer);
  const computed = node?.['x-computed'];
  if (!node || computed === undefined) return [];
  if (!isRecord(computed)) return ['x-computed must be an object.'];

  const evaluatedBy = computed.evaluatedBy;
  if (evaluatedBy === 'server') return ["x-computed.evaluatedBy 'server' has been renamed; use 'runtime'."];
  if (evaluatedBy === 'client') return [];
  const issues: string[] = [];
  if (evaluatedBy !== 'runtime') issues.push("x-computed.evaluatedBy must be 'runtime' or 'client'.");

  const segments = parsePointer(pointer);
  const nested =
    segments.length >= 2 && segments.length % 2 === 0 && segments.every((s, i) => i % 2 === 1 || s === 'properties');
  if (!nested) {
    issues.push(
      "A runtime x-computed is evaluated only on a property reached through nested 'properties' — not the root, items, $defs, combinators or conditionals.",
    );
  }
  const self = segments[segments.length - 1];
  const parent = getNodeAt(componentJson, parentPointer(parentPointer(pointer) ?? '') ?? '');
  if (nested && self && parent && Array.isArray(parent.required) && parent.required.includes(self)) {
    issues.push("A runtime computed field is never stored and cannot be 'required'.");
  }
  const stored = STORED_ONLY.filter((key) => node[key] !== undefined && node[key] !== false);
  if (stored.length > 0) issues.push(`A runtime computed field is never stored; it cannot be combined with ${stored.join(', ')}.`);
  if (isAtRestEncrypted(node)) issues.push('A runtime computed field cannot carry an at-rest x-encryption.');

  const cases = Array.isArray(computed.cases) ? computed.cases : [];
  if (cases.length === 0 && computed.fallback === undefined) issues.push("x-computed needs 'cases' or a 'fallback'.");

  const siblings = new Map<string, SchemaNode>();
  if (parent && isRecord(parent.properties)) {
    for (const [key, value] of Object.entries(parent.properties)) {
      if (key !== self && isRecord(value)) siblings.set(key, value);
    }
  }
  cases.forEach((entry, index) => issues.push(...operationIssues(entry, `x-computed.cases[${index}]`, siblings)));
  if (computed.fallback !== undefined) issues.push(...operationIssues(computed.fallback, 'x-computed.fallback', siblings));
  if (computed.whenAbsent !== undefined && computed.whenAbsent !== 'empty' && computed.whenAbsent !== 'null') {
    issues.push("x-computed.whenAbsent must be 'empty' or 'null'.");
  }
  return issues;
}
