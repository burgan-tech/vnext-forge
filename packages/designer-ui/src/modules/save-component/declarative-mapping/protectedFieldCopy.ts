/**
 * Forge-only advisory for `x-encryption` fields copied out of `input`
 * (runtime `docs/runtime/declarative-task-mappings.md` § input, and
 * `docs/domain/field-masking.md`).
 *
 * `input` carries the request as the client sent it, so an `x-encryption`
 * field is plaintext there. The runtime's write funnel protects only the
 * schema's own `encrypt` / `hash` paths: an output `set` entry that writes
 * `input.email` to `$.email` is sealed, the same value written to
 * `$.contactNote` is stored in plaintext and nothing at runtime notices.
 *
 * The runtime cannot warn at publish: components deploy independently, the
 * master schema may not be published yet, and a field may become `encrypt`
 * later. Forge can, while the author edits and the workflow's master schema is
 * in the project — and only then. It is a hint, not a guarantee: it sees plain
 * `input.a.b` / `input["a"]` reads, not values passed around inside an expression.
 */
import {
  pathSegment,
  toSiteKind,
  type MappingBlock,
  type MappingIssue,
  type MappingPhase,
  type MappingSiteKind,
} from './declarativeMapping';

const MAX_DEPTH = 8;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export type ProtectionType = 'encrypt' | 'hash';

export interface ProtectedPath {
  segments: string[];
  type: ProtectionType;
}

/** Master schema properties carrying `x-encryption` `encrypt` or `hash` (nested objects only, like the runtime). */
export function protectedPaths(schemaRoot: unknown): ProtectedPath[] {
  const out: ProtectedPath[] = [];
  const walk = (node: Record<string, unknown>, segments: string[], depth: number) => {
    if (depth > MAX_DEPTH || !isRecord(node.properties)) return;
    for (const [name, child] of Object.entries(node.properties)) {
      if (!isRecord(child)) continue;
      const next = [...segments, name];
      const enc = child['x-encryption'];
      if (isRecord(enc) && (enc.type === 'encrypt' || enc.type === 'hash')) {
        out.push({ segments: next, type: enc.type });
      }
      walk(child, next, depth + 1);
    }
  };
  if (isRecord(schemaRoot)) walk(schemaRoot, [], 0);
  return out;
}

/** Segments of a write path (`$.a.b`, `$['a b'].c`); `undefined` when it is not one. */
export function writePathSegments(path: string): string[] | undefined {
  if (!path.startsWith('$')) return undefined;
  const segments: string[] = [];
  const re = /\.([A-Za-z_][\w-]*)|\['((?:[^'\\]|\\.)*)'\]/gy;
  re.lastIndex = 1;
  while (re.lastIndex < path.length) {
    const m = re.exec(path);
    if (!m) return undefined;
    segments.push(m[1] ?? m[2].replace(/\\(.)/g, '$1'));
  }
  return segments.length > 0 ? segments : undefined;
}

/**
 * The `input` paths an expression reads: `input.a.b`, `input["a"]`, `input['a'].b`.
 * String literals are ignored, so `"input.email"` inside quotes is not a read.
 */
export function inputReads(expression: string): string[][] {
  const reads: string[][] = [];
  // Replace string literals that are not an indexer argument, keeping indexers intact.
  const re = /\binput((?:\s*\.\s*[A-Za-z_]\w*|\s*\[\s*(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*\])+)/g;
  const code = stripLiteralsOutsideIndexers(expression);
  for (const m of code.matchAll(re)) {
    if (m.index && /[\w.]/.test(code[m.index - 1])) continue; // a member named input, e.g. data.input
    const segments: string[] = [];
    const seg = /\.\s*([A-Za-z_]\w*)|\[\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')\s*\]/g;
    for (const s of m[1].matchAll(seg)) {
      segments.push(s[1] ?? (s[2] ?? s[3]).replace(/\\(.)/g, '$1'));
    }
    // Conversions and methods (input.amount.AsDouble(), input.has(...)) are not data segments.
    const call = m[0].length + (m.index ?? 0) < code.length && code[(m.index ?? 0) + m[0].length] === '(';
    if (call) segments.pop();
    if (segments.length > 0) reads.push(segments);
  }
  return reads;
}

/** Blanks string literals except the ones that are an indexer argument (`x["a"]`). */
function stripLiteralsOutsideIndexers(expression: string): string {
  return expression.replace(/(\[\s*)?("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, (all, bracket: string | undefined) =>
    bracket ? all : '""',
  );
}

function isPrefix(a: readonly string[], b: readonly string[]): boolean {
  return a.length <= b.length && a.every((s, i) => s === b[i]);
}

function same(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && isPrefix(a, b);
}

/** `input.a.b` / `input["a b"]` — the expression form. */
function expressionPath(segments: readonly string[]): string {
  return 'input' + segments.map((s) => (/^[A-Za-z_]\w*$/.test(s) ? `.${s}` : `["${s}"]`)).join('');
}

/** `$.a.b` / `$['a b']` — the data path form. */
function dataPath(segments: readonly string[]): string {
  return '$' + segments.map(pathSegment).join('');
}

/**
 * Warnings for task-output and transition-output `set` entries (both read the
 * hop's `input` and write instance data) that read an `x-encryption` field from
 * `input` (or an object containing one) into a path the write funnel does not
 * protect. Writing it back to the same path, or to another protected path, is fine.
 * No master schema, no warning.
 */
export function protectedCopyIssues(
  phaseOrSite: MappingPhase | MappingSiteKind,
  block: MappingBlock | undefined,
  schemaRoot: unknown,
): MappingIssue[] {
  const site = toSiteKind(phaseOrSite);
  if (site !== 'taskOutput' && site !== 'transitionOutput') return [];
  if (!block || !isRecord(block.set)) return [];
  const protectedList = protectedPaths(schemaRoot);
  if (protectedList.length === 0) return [];

  const issues: MappingIssue[] = [];
  for (const [key, expression] of Object.entries(block.set)) {
    if (typeof expression !== 'string') continue;
    const target = writePathSegments(key);
    if (!target) continue;
    if (protectedList.some((p) => same(p.segments, target))) continue;

    for (const read of inputReads(expression)) {
      if (same(read, target)) continue; // written back to its own path: the funnel seals what it protects
      const hit = protectedList.find((p) => isPrefix(read, p.segments) || isPrefix(p.segments, read));
      if (!hit) continue;
      issues.push({
        field: `set['${key}']`,
        part: 'expression',
        severity: 'warning',
        message:
          `${expressionPath(read)} is the plaintext of the x-encryption (${hit.type}) field ${dataPath(hit.segments)}; ` +
          `${key} is not protected, so the value is stored in plaintext. Write it to ${dataPath(hit.segments)} ` +
          `or remove the copy.`,
      });
      break;
    }
  }
  return issues;
}
