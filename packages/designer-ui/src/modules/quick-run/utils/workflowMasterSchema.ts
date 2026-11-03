import {
  loadSchemaComponent,
  readSchemaReference,
  type SchemaComponentLoaderDeps,
} from '../../vnext-workspace/loadSchemaComponent';
import { storageFieldPaths, storageFieldTransports, type StorageTransport } from './fileFields';
import { collectMasterSchemaFields, isRecord, type MasterSchemaField } from './masterSchemaFields';

export type MasterSchemaLoad =
  | { status: 'none' }
  | { status: 'unavailable' }
  | { status: 'ready'; schemaKey: string; fields: MasterSchemaField[] };

export interface MasterSchemaLoaderDeps extends SchemaComponentLoaderDeps {
  resolveWorkflowFile: (workflowKey: string) => Promise<{ path: string; projectId: string } | null>;
}

const NONE: MasterSchemaLoad = { status: 'none' };
const UNAVAILABLE: MasterSchemaLoad = { status: 'unavailable' };

type MasterSchemaRoot =
  | { status: 'none' }
  | { status: 'unavailable' }
  | { status: 'ready'; schemaKey: string; root: Record<string, unknown> };

/** The workflow's local master schema JSON (`attributes.schema` of its schema component). */
async function loadMasterSchemaRoot(workflowKey: string, deps: MasterSchemaLoaderDeps): Promise<MasterSchemaRoot> {
  try {
    const workflowFile = await deps.resolveWorkflowFile(workflowKey);
    if (!workflowFile) return { status: 'unavailable' };
    const workflow: unknown = JSON.parse(await deps.readText(workflowFile.path));
    const attributes = isRecord(workflow) ? workflow.attributes : undefined;
    const ref = readSchemaReference(isRecord(attributes) ? attributes.schema : undefined);
    if (!ref) return { status: 'none' };
    const component = await loadSchemaComponent(workflowFile.projectId, ref, deps);
    const componentAttributes = component?.attributes;
    const schemaRoot = isRecord(componentAttributes) ? componentAttributes.schema : undefined;
    if (!isRecord(schemaRoot)) return { status: 'unavailable' };
    return { status: 'ready', schemaKey: ref.key, root: schemaRoot };
  } catch {
    return { status: 'unavailable' };
  }
}

/**
 * Local master schema (`attributes.schema` of the workflow file) as QuickRunner
 * filter fields. `none` when the workflow declares no master schema,
 * `unavailable` when anything cannot be read.
 */
export async function loadWorkflowMasterSchema(
  workflowKey: string,
  deps: MasterSchemaLoaderDeps,
): Promise<MasterSchemaLoad> {
  const master = await loadMasterSchemaRoot(workflowKey, deps);
  if (master.status !== 'ready') return master;
  const fields = collectMasterSchemaFields(master.root);
  // A master schema with zero collected fields is what the runtime's
  // SchemaFilterMetadataResolver.Resolve returns null for — no field
  // metadata means no filter enforcement, i.e. the same as declaring no
  // master schema at all. Reporting `ready` with an empty list would
  // instead read as "enforced, and nothing is allowed".
  if (fields.length === 0) return NONE;
  return { status: 'ready', schemaKey: master.schemaKey, fields };
}

export interface WorkflowStorageFields {
  /** Dotted paths of the master schema's `x-storage` file fields. */
  paths: string[];
  /** The non-`inline` transports among them (runtime 0.0.102). */
  transports: Record<string, StorageTransport>;
}

/** The master schema's `x-storage` file fields (empty when none or unreadable). */
export async function loadWorkflowStorageFields(
  workflowKey: string,
  deps: MasterSchemaLoaderDeps,
): Promise<WorkflowStorageFields> {
  const master = await loadMasterSchemaRoot(workflowKey, deps);
  return master.status === 'ready'
    ? { paths: storageFieldPaths(master.root), transports: storageFieldTransports(master.root) }
    : { paths: [], transports: {} };
}
