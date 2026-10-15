import { useEffect, useState } from 'react';

import type { SchemaRole } from '@vnext-forge-studio/vnext-types';

import { callApi } from '../../../api/client';
import { createLogger } from '../../../lib/logger/createLogger';
import { useProjectStore } from '../../../store/useProjectStore';
import { useSchemaEditorStore } from '../useSchemaEditorStore';

const logger = createLogger('useInferredSchemaRole');

interface InferRoleResult {
  role: SchemaRole | '';
  referrers: string[];
}

/**
 * Role the open schema should carry, inferred by the host from where the
 * project's components reference it (`vnext/schemas/inferRole`). Asked only
 * while `enabled` (e.g. the current type is a legacy value), since the host
 * reads every component of the project to answer.
 */
export function useInferredSchemaRole(enabled: boolean): SchemaRole | undefined {
  const projectId = useProjectStore((s) => s.activeProject?.id);
  const filePath = useSchemaEditorStore((s) => s.filePath);
  const [role, setRole] = useState<SchemaRole | undefined>(undefined);

  useEffect(() => {
    setRole(undefined);
    if (!enabled || !projectId || !filePath) return;
    let cancelled = false;
    void callApi<InferRoleResult>({ method: 'vnext/schemas/inferRole', params: { id: projectId, path: filePath } })
      .then((response) => {
        if (cancelled) return;
        if (response.success) setRole(response.data.role || undefined);
        else logger.warn('Schema role inference failed');
      })
      .catch(() => {
        if (!cancelled) logger.warn('Schema role inference failed');
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, projectId, filePath]);

  return role;
}
