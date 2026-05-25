/**
 * Parse / serialize / repair `BuilderDefinition` objects coming from disk.
 *
 * The on-disk `attributes.content` for a pseudo-ui view is either a JSON
 * string or already an object. We always work with a defensive object copy
 * in the builder state and serialize back to a pretty-printed string when
 * emitting `onContentChange`.
 */

import {
  PSEUDO_UI_VIEW_SCHEMA_URL,
  type BuilderDefinition,
  type BuilderNode,
} from '../types';

const EMPTY_VIEW: BuilderNode = {
  type: 'Column',
  gap: 'md',
  children: [],
};

export const EMPTY_DEFINITION: BuilderDefinition = Object.freeze({
  $schema: PSEUDO_UI_VIEW_SCHEMA_URL,
  dataSchema: '',
  view: EMPTY_VIEW,
});

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Best-effort parse of arbitrary content into a builder definition. */
export function parseBuilderDefinition(content: string | object | null | undefined): BuilderDefinition {
  if (content == null || content === '') return cloneDefinition(EMPTY_DEFINITION);

  let raw: unknown;
  if (typeof content === 'string') {
    const trimmed = content.trim();
    if (trimmed === '') return cloneDefinition(EMPTY_DEFINITION);
    try {
      raw = JSON.parse(trimmed);
    } catch {
      return cloneDefinition(EMPTY_DEFINITION);
    }
  } else {
    raw = content;
  }
  if (!isPlainObject(raw)) return cloneDefinition(EMPTY_DEFINITION);

  const view = isPlainObject(raw.view) && typeof raw.view.type === 'string'
    ? (raw.view as BuilderNode)
    : { ...EMPTY_VIEW };

  const def: BuilderDefinition = {
    $schema: typeof raw.$schema === 'string' ? raw.$schema : PSEUDO_UI_VIEW_SCHEMA_URL,
    dataSchema: typeof raw.dataSchema === 'string' || isPlainObject(raw.dataSchema)
      ? (raw.dataSchema)
      : '',
    view,
  };
  if (Array.isArray(raw.lookups)) {
    def.lookups = raw.lookups.filter((l): l is string => typeof l === 'string');
  }
  if (isPlainObject(raw.uiState)) {
    def.uiState = raw.uiState;
  }

  // R25.A-6: project legacy Card.onTap → canonical Card.action on
  // load. SDK reads both shapes, but the builder Inspector edits a
  // single `action` field per `componentMeta.actionCapability`'s
  // `preferredField`. Without this projection, a Card that ships
  // with `onTap` would render with an empty Action picker in the
  // Inspector. The projection is one-shot at parse time; the
  // serialized JSON written back on save uses `action`.
  projectCardActionAlias(def.view);

  return def;
}

function projectCardActionAlias(node: BuilderNode): void {
  if (!isPlainObject(node)) return;
  if (node.type === 'Card') {
    const onTap = (node as Record<string, unknown>).onTap;
    const action = (node as Record<string, unknown>).action;
    if (onTap !== undefined && action === undefined) {
      (node as Record<string, unknown>).action = onTap;
      delete (node as Record<string, unknown>).onTap;
    }
  }
  const children = (node as { children?: unknown }).children;
  if (Array.isArray(children)) {
    for (const child of children) {
      if (isPlainObject(child)) projectCardActionAlias(child as BuilderNode);
    }
  }
}

/** Stringify a definition to the JSON string saved into `attributes.content`. */
export function serializeBuilderDefinition(def: BuilderDefinition): string {
  return JSON.stringify(def, null, 2);
}

export function cloneDefinition(def: BuilderDefinition): BuilderDefinition {
  return JSON.parse(JSON.stringify(def)) as BuilderDefinition;
}

/** Shallow equality on the JSON-serialized form — sufficient for change detection. */
export function definitionsEqual(a: BuilderDefinition, b: BuilderDefinition): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
