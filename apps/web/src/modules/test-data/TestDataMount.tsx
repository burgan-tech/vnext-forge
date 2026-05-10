import { useCallback } from 'react';

import {
  discoverVnextComponentsByCategory,
  TestDataPicker,
  useGlobalTestDataPickerShortcut,
  useProjectStore,
  type SchemaComponentEntry,
} from '@vnext-forge-studio/designer-ui';

/**
 * Web shell mount for the test-data generator overlay.
 *
 * Owns the project-aware discovery callback (uses `vnext/schemas/list`)
 * and registers the `Cmd+Shift+G` global shortcut. The native-menu IPC
 * bridge handles the same `'generate-test-data'` shortcut id.
 *
 * Schema entries that don't fit the `<schemas-root>/<group>/<name>.json`
 * shape are intentionally hidden from the picker — top-level schemas
 * exist in some projects (`Schemas/headers-1.0.0.json`) but the backend
 * `generateForSchemaComponent` is two-segment-only in this MVP. Workaround
 * for those is the planned "paste a schema" mode (deferred follow-up).
 */
export function TestDataMount() {
  const activeProject = useProjectStore((s) => s.activeProject);

  useGlobalTestDataPickerShortcut({ projectId: activeProject?.id ?? null });

  const loadSchemas = useCallback(
    async (projectId: string): Promise<SchemaComponentEntry[]> => {
      const list = await discoverVnextComponentsByCategory(projectId, 'schemas');
      const out: SchemaComponentEntry[] = [];
      for (const c of list) {
        // Path coming back is project-relative POSIX. We slice off the
        // `<schemas-root>` prefix to get the part inside the schemas
        // folder; whatever's left should be `<group>/<name>.json`.
        const segments = c.path.replace(/\\/g, '/').split('/');
        // Find the last `<schemas>` segment (case-insensitive) and assume
        // anything after it is the group/name region.
        let i = segments.length - 1;
        while (i >= 0 && segments[i].toLowerCase() !== 'schemas') i -= 1;
        if (i < 0) continue;
        const after = segments.slice(i + 1);
        if (after.length !== 2) continue; // top-level files skipped
        const group = after[0];
        const file = after[1];
        if (!file.toLowerCase().endsWith('.json')) continue;
        const name = file.slice(0, -'.json'.length);
        out.push({
          group,
          name,
          label: `${group} / ${name}`,
          filePath: c.path,
        });
      }
      // Group → name sort for a stable picker order.
      out.sort((a, b) => {
        const g = a.group.localeCompare(b.group);
        return g !== 0 ? g : a.name.localeCompare(b.name);
      });
      return out;
    },
    [],
  );

  return <TestDataPicker projectId={activeProject?.id ?? null} loadSchemas={loadSchemas} />;
}
