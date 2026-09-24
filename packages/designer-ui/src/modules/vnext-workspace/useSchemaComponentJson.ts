import { useEffect, useState } from 'react';

import { useProjectStore } from '../../store/useProjectStore.js';
import { subscribeWorkspaceFsChange } from '../../workspace-fs-events/index.js';
import { loadSchemaComponent, type SchemaReferenceLike } from './loadSchemaComponent.js';

/**
 * The referenced schema component of the active project, reloaded when the
 * reference changes or a workspace file is written (e.g. the schema is fixed
 * in the modal editor). `null` while loading, when absent, or on failure.
 */
export function useSchemaComponentJson(ref: SchemaReferenceLike | null): Record<string, unknown> | null {
  const projectId = useProjectStore((s) => s.activeProject?.id);
  const [json, setJson] = useState<Record<string, unknown> | null>(null);
  const [revision, setRevision] = useState(0);
  const key = ref?.key;
  const domain = ref?.domain;

  useEffect(() => subscribeWorkspaceFsChange(() => setRevision((r) => r + 1)), []);

  useEffect(() => {
    if (!projectId || !key) {
      setJson(null);
      return;
    }
    let cancelled = false;
    void loadSchemaComponent(projectId, { key, ...(domain ? { domain } : {}) }).then((loaded) => {
      if (!cancelled) setJson(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, key, domain, revision]);

  return json;
}
