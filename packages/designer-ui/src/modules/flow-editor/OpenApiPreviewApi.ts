import type { VnextExportCategory } from '@vnext-forge-studio/app-contracts';
import { discoverVnextComponentsByCategory } from '../vnext-workspace/vnextComponentDiscovery';
import { readOptionalFile } from '../project-workspace/WorkspaceApi';
import { createLogger } from '../../lib/logger/createLogger';

const logger = createLogger('flow-editor/OpenApiPreviewApi');

/**
 * Reads every component of the given categories and returns the parsed JSON
 * objects, ready to feed into `createSchemaResolver` / `createComponentResolver`
 * from `@vnext-forge-studio/doc-gen`.
 *
 * The designer is a no-runtime surface, so references are resolved by reading
 * the matching component files directly (the same approach as `buildSchemaLoader`
 * in the view editor). Unreadable or malformed files are skipped — the OpenAPI
 * builder falls back to permissive defaults for any reference it cannot resolve.
 */
export async function collectComponents(
  projectId: string,
  categories: readonly VnextExportCategory[],
): Promise<unknown[]> {
  const out: unknown[] = [];
  await Promise.all(
    categories.map(async (category) => {
      const components = await discoverVnextComponentsByCategory(projectId, category);
      await Promise.all(
        components.map(async (component) => {
          try {
            const file = await readOptionalFile(component.path);
            if (!file) return;
            out.push(JSON.parse(file.content));
          } catch (err) {
            logger.warn('failed to read/parse component', {
              category,
              path: component.path,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }),
      );
    }),
  );
  return out;
}
