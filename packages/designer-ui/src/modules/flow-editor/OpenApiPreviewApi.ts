import { discoverVnextComponentsByCategory } from '../vnext-workspace/vnextComponentDiscovery';
import { readOptionalFile } from '../project-workspace/WorkspaceApi';
import { createLogger } from '../../lib/logger/createLogger';

const logger = createLogger('flow-editor/OpenApiPreviewApi');

/**
 * Reads every Schema component in the project and returns the parsed JSON
 * objects, ready to feed into `createSchemaResolver` from `@vnext-forge-studio/doc-gen`.
 *
 * The designer is a no-runtime surface, so transition/master schema references
 * are resolved by reading the matching Schemas component files directly (the
 * same approach as `buildSchemaLoader` in the view editor). Unreadable or
 * malformed files are skipped — the OpenAPI builder falls back to a permissive
 * object schema for any reference it cannot resolve.
 */
export async function collectSchemaComponents(projectId: string): Promise<unknown[]> {
  const components = await discoverVnextComponentsByCategory(projectId, 'schemas');
  const out: unknown[] = [];
  await Promise.all(
    components.map(async (component) => {
      try {
        const file = await readOptionalFile(component.path);
        if (!file) return;
        out.push(JSON.parse(file.content));
      } catch (err) {
        logger.warn('failed to read/parse schema component', {
          path: component.path,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }),
  );
  return out;
}
