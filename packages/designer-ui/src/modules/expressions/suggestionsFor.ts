/**
 * Suggestions for the member being typed in an expression on any surface. Block surfaces keep the block
 * editor's `expressionSuggestions`; slot surfaces (condition, value, key, timer, string, decision, agent tool)
 * build theirs from the catalog the same way.
 */
import {
  expressionSuggestions,
  filterPaths,
  schemaChildren,
  schemaProperties,
  type CompletionContext,
  type ExpressionToken,
} from '../save-component/declarative-mapping/declarativeMappingCompletions';
import {
  conversionsOf,
  functionsOf,
  membersOf,
  staticsOf,
  variablesOf,
  type ExpressionSurface,
  type SlotSurface,
} from './expressionCatalog';

const SLOT_SURFACES: readonly ExpressionSurface[] = [
  'condition',
  'value',
  'key',
  'timer',
  'string',
  'decision',
  'agentTool',
] satisfies readonly SlotSurface[];

/** Conversions offered after a JSON value; `AsJsonElement()` is left out, as in the block editor. */
const jsonConversions = (surface: ExpressionSurface): string[] =>
  conversionsOf(surface)
    .map((e) => e.name)
    .filter((n) => n !== 'AsJsonElement()');

/** Master schema children at `segments` (identifier-safe names), plus conversions below the root. */
function dataChildren(schemaRoot: unknown, segments: readonly string[], surface: ExpressionSurface): string[] {
  const children = schemaChildren(schemaProperties(schemaRoot), segments).map(
    (p) => p.segments[p.segments.length - 1],
  );
  return segments.length === 0 ? children : [...children, ...jsonConversions(surface)];
}

function slotSuggestions(surface: ExpressionSurface, token: ExpressionToken, schemaRoot: unknown): string[] {
  const { chain, query } = token;
  if (chain.length === 0) {
    return filterPaths(
      [
        ...variablesOf(surface).map((e) => e.name),
        ...functionsOf(surface).map((e) => e.insertText ?? e.name),
        ...staticsOf(surface).map((e) => e.name),
      ],
      query,
    );
  }
  const [root, ...rest] = chain;
  if (staticsOf(surface).some((e) => e.name === root)) {
    return rest.length === 0 ? filterPaths(membersOf(root, surface).map((e) => e.name), query) : [];
  }
  if (!variablesOf(surface).some((v) => v.name === root)) return [];
  switch (root) {
    case 'data':
      return filterPaths(dataChildren(schemaRoot, rest, surface), query);
    case 'input':
      return filterPaths(jsonConversions(surface), query);
    case 'outcome':
      if (rest.length === 1 && rest[0] === 'output') return filterPaths(jsonConversions(surface), query);
      if (rest.length > 0) return [];
      break;
    case 'instance':
      if (rest.length === 0) break;
      return rest[0] === 'data' ? filterPaths(dataChildren(schemaRoot, rest.slice(1), surface), query) : [];
    default:
      if (rest.length > 0) return [];
  }
  return filterPaths(
    membersOf(root, surface).map((e) => e.name),
    query,
  );
}

/** The suggestions for `token` on `surface`, in display order. */
export function suggestionsFor(
  surface: ExpressionSurface,
  token: ExpressionToken,
  schemaRoot: unknown,
  context?: CompletionContext,
): string[] {
  if (SLOT_SURFACES.includes(surface)) return slotSuggestions(surface, token, schemaRoot);
  return expressionSuggestions(surface as Exclude<ExpressionSurface, SlotSurface>, token, schemaRoot, context);
}
