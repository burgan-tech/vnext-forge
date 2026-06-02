import type { DataSchema, ViewDefinition } from '@burgan-tech/pseudo-ui';

import { discoverVnextComponentsByCategory } from '../../vnext-workspace/vnextComponentDiscovery';
import * as WorkspaceApi from '../../project-workspace/WorkspaceApi';
import { parseComponentRef, type ComponentRef } from './parseComponentRef';
import { parseDataSchemaRef } from './parseDataSchemaRef';

/**
 * Locate a workspace view-component file by ref, read its
 * `attributes.schema` (URN) → resolve schema file → read both →
 * return the SDK-shaped `{ schema, view }` pair the pseudo-ui
 * `loadComponent` delegate contract requires.
 *
 * Discovery uses the existing `vnext/views/list` RPC (the same call
 * the View Editor's component browser uses); schema resolution
 * mirrors `createDataSchemaResolver` but reads from disk rather than
 * the engine, because nested `Component` rendering during simulation
 * is local — the engine has no concept of "render this child view".
 *
 * Returns `null` for unparseable refs or workspace misses. The
 * caller (`createQuickRunPseudoDelegate.loadComponent`) logs +
 * returns an empty `{schema, view}` placeholder so SDK renders the
 * Component node as an empty container rather than crashing.
 */
export interface ResolvedComponentFile {
  schema: DataSchema;
  view: ViewDefinition;
}

export interface ResolveComponentFileParams {
  /** The current Forge project — used to scope workspace discovery. */
  projectId: string;
  /** SDK-supplied component ref (URN, URL, or bare key). */
  ref: string;
}

interface ViewComponentFile {
  key?: string;
  attributes?: {
    /** Schema URN — same shape as the top-level `dataSchema` field. */
    schema?: string;
    /** The actual ViewDefinition payload. */
    content?: ViewDefinition;
  };
}

interface SchemaComponentFile {
  key?: string;
  attributes?: {
    /** JSON Schema payload. */
    schema?: DataSchema;
  };
}

export async function resolveComponentFile(
  params: ResolveComponentFileParams,
): Promise<ResolvedComponentFile | null> {
  const parsed = parseComponentRef(params.ref);
  if (!parsed) return null;

  const viewFile = await findAndReadView(params.projectId, parsed);
  if (!viewFile) return null;
  const view = viewFile.attributes?.content;
  if (!view) return null;

  const schemaUrn = viewFile.attributes?.schema;
  const schema = await loadSchemaForComponent(params.projectId, schemaUrn);

  return { schema, view };
}

async function findAndReadView(
  projectId: string,
  ref: ComponentRef,
): Promise<ViewComponentFile | null> {
  const components = await discoverVnextComponentsByCategory(projectId, 'views');
  // Match by key first. If the ref carries a `domain`, we'd ideally
  // filter by flow too — but the discovery payload uses `flow` (the
  // workflow it lives under), not domain. View components can be
  // shared across workflows in the same domain, so a key match is
  // the safe default. If multiple keys collide, take the first.
  const candidate = components.find((c) => c.key === ref.key);
  if (!candidate) return null;
  try {
    const fileRead = await WorkspaceApi.readFile(candidate.path);
    return JSON.parse(fileRead.content) as ViewComponentFile;
  } catch {
    return null;
  }
}

/**
 * The schema URN inside a view file usually points to a Schemas
 * component. We read that one too so the nested PseudoView mount
 * gets a real schema for validation / x-conditional / x-lov work.
 * Falls back to an empty schema object if anything along the chain
 * fails — the SDK tolerates `{}` and the child view will simply
 * render without schema-driven enrichments.
 */
async function loadSchemaForComponent(
  projectId: string,
  schemaUrn: string | undefined,
): Promise<DataSchema> {
  const EMPTY: DataSchema = {} as DataSchema;
  if (!schemaUrn) return EMPTY;
  const schemaRef = parseDataSchemaRef(schemaUrn);
  if (!schemaRef) return EMPTY;
  try {
    const components = await discoverVnextComponentsByCategory(projectId, 'schemas');
    const candidate = components.find((c) => c.key === schemaRef.key);
    if (!candidate) return EMPTY;
    const fileRead = await WorkspaceApi.readFile(candidate.path);
    const parsedFile = JSON.parse(fileRead.content) as SchemaComponentFile;
    return parsedFile.attributes?.schema ?? EMPTY;
  } catch {
    return EMPTY;
  }
}
