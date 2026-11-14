import { useEffect, useState } from 'react';
import type { DiscoveredVnextComponent } from '@vnext-forge-studio/app-contracts';

import { discoverVnextComponentsByCategory } from '../vnext-workspace/vnextComponentDiscovery';
import { readFile } from '../project-workspace/WorkspaceApi';
import { createLogger } from '../../lib/logger/createLogger';
import { isRecord, type Json } from './agentDocument';

const logger = createLogger('agent-editor/useAgentCatalog');

/**
 * The project's `sys-agents` components and, for the selected reference,
 * its parsed JSON (tools for the `tools.exclude` picker, output schema for
 * the dry run). Read-only; failures leave the lists empty.
 */
export function useAgentCatalog(projectId: string | undefined, selectedKey: string | undefined) {
  const [agents, setAgents] = useState<DiscoveredVnextComponent[]>([]);
  const [selected, setSelected] = useState<{ component: DiscoveredVnextComponent; json: Json } | null>(null);

  useEffect(() => {
    if (!projectId) {
      setAgents([]);
      return;
    }
    let cancelled = false;
    discoverVnextComponentsByCategory(projectId, 'agents')
      .then((rows) => {
        if (!cancelled) setAgents(rows);
      })
      .catch((err) => {
        logger.warn('Agent discovery failed', err);
        if (!cancelled) setAgents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    const component = selectedKey ? agents.find((a) => a.key === selectedKey) : undefined;
    if (!component) {
      setSelected(null);
      return;
    }
    let cancelled = false;
    readFile(component.path)
      .then(({ content }) => {
        const parsed: unknown = typeof content === 'string' ? JSON.parse(content) : content;
        if (!cancelled) setSelected(isRecord(parsed) ? { component, json: parsed } : null);
      })
      .catch((err) => {
        logger.warn('Agent component could not be read', err);
        if (!cancelled) setSelected(null);
      });
    return () => {
      cancelled = true;
    };
  }, [agents, selectedKey]);

  return { agents, selected };
}
