import {
  loadSchemaComponent,
  readSchemaReference,
  type SchemaComponentLoaderDeps,
} from '../../vnext-workspace/loadSchemaComponent';
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

/**
 * Local master schema (`attributes.schema` of the workflow file) as QuickRunner
 * filter fields. `none` when the workflow declares no master schema,
 * `unavailable` when anything cannot be read.
 */
export async function loadWorkflowMasterSchema(
  workflowKey: string,
  deps: MasterSchemaLoaderDeps,
): Promise<MasterSchemaLoad> {
  try {
    const workflowFile = await deps.resolveWorkflowFile(workflowKey);
    if (!workflowFile) return UNAVAILABLE;
    const workflow: unknown = JSON.parse(await deps.readText(workflowFile.path));
    const attributes = isRecord(workflow) ? workflow.attributes : undefined;
    const ref = readSchemaReference(isRecord(attributes) ? attributes.schema : undefined);
    if (!ref) return NONE;
    const component = await loadSchemaComponent(workflowFile.projectId, ref, deps);
    const componentAttributes = component?.attributes;
    const schemaRoot = isRecord(componentAttributes) ? componentAttributes.schema : undefined;
    if (!isRecord(schemaRoot)) return UNAVAILABLE;
    const fields = collectMasterSchemaFields(schemaRoot);
    // A master schema with zero collected fields is what the runtime's
    // SchemaFilterMetadataResolver.Resolve returns null for — no field
    // metadata means no filter enforcement, i.e. the same as declaring no
    // master schema at all. Reporting `ready` with an empty list would
    // instead read as "enforced, and nothing is allowed".
    if (fields.length === 0) return NONE;
    return { status: 'ready', schemaKey: ref.key, fields };
  } catch {
    return UNAVAILABLE;
  }
}
