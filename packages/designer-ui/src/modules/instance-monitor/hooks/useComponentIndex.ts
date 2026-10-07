import { useEffect, useState } from 'react';

import type { DiscoveredVnextComponent, VnextExportCategory } from '@vnext-forge-studio/app-contracts';

import { createLogger } from '../../../lib/logger/createLogger';
import { discoverVnextComponentsByCategory } from '../../vnext-workspace/vnextComponentDiscovery';
import { buildComponentIndex, MONITOR_LINK_CATEGORIES, type ComponentIndex } from '../model/componentIndex';

const logger = createLogger('instance-monitor/useComponentIndex');

/**
 * Discovers every linkable component of the project once. A category that
 * fails to load is indexed empty, so its links read "Not in this workspace"
 * instead of spinning forever.
 */
export function useComponentIndex(projectId: string | undefined): ComponentIndex {
  const [index, setIndex] = useState<ComponentIndex>({});

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void Promise.all(
      MONITOR_LINK_CATEGORIES.map(async (category): Promise<readonly [VnextExportCategory, DiscoveredVnextComponent[]]> => {
        try {
          return [category, await discoverVnextComponentsByCategory(projectId, category)];
        } catch (err) {
          logger.warn(`Component discovery failed for ${category}`, err);
          return [category, []];
        }
      }),
    ).then((entries) => {
      if (!cancelled) setIndex(buildComponentIndex(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return index;
}
