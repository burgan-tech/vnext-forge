import { useCallback, useEffect, useState } from 'react';

import * as QuickRunApi from '../QuickRunApi';
import { useQuickRunPolling } from '../hooks/useQuickRunPolling';
import { useQuickRunStore } from '../store/quickRunStore';
import type { InstanceListItem } from '../types/quickrun.types';
import { EnvBadge } from './EnvBadge';
import { InstanceFilterPanel } from './InstanceFilterPanel';
import { StatusBadge } from './StatusBadge';

export function InstanceListPanel() {
  const domain = useQuickRunStore((s) => s.domain);
  const workflowKey = useQuickRunStore((s) => s.workflowKey);
  const instanceList = useQuickRunStore((s) => s.instanceList);
  const instanceListLoading = useQuickRunStore((s) => s.instanceListLoading);
  const setInstanceList = useQuickRunStore((s) => s.setInstanceList);
  const setInstanceListLoading = useQuickRunStore((s) => s.setInstanceListLoading);
  const instances = useQuickRunStore((s) => s.instances);
  const activeTabId = useQuickRunStore((s) => s.activeTabId);
  const setActiveTab = useQuickRunStore((s) => s.setActiveTab);
  const addInstance = useQuickRunStore((s) => s.addInstance);
  const addTab = useQuickRunStore((s) => s.addTab);
  const globalHeaders = useQuickRunStore((s) => s.globalHeaders);
  const environmentName = useQuickRunStore((s) => s.environmentName);

  const pollingConfig = useQuickRunStore((s) => s.pollingConfig);
  const { pollState } = useQuickRunPolling(pollingConfig);

  const [showFilter, setShowFilter] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | undefined>();
  const [activeOrderBy, setActiveOrderBy] = useState<string | undefined>(
    JSON.stringify({ field: 'createdAt', direction: 'desc' }),
  );

  const openInstance = useCallback((item: InstanceListItem) => {
    if (instances.has(item.id)) {
      setActiveTab(item.id);
      return;
    }
    addInstance({
      id: item.id,
      key: item.key,
      status: item.metadata.status,
      domain: item.domain,
      workflowKey: item.flow,
      environmentName,
      currentState: item.metadata.currentState,
      startedAt: item.metadata.createdAt,
    });
    addTab({
      instanceId: item.id,
      domain: item.domain,
      workflowKey: item.flow,
      environmentName,
      label: item.key || item.id.slice(0, 8),
    });
    void pollState({
      domain: item.domain,
      workflowKey: item.flow,
      instanceId: item.id,
      headers: globalHeaders,
    });
  }, [instances, addInstance, addTab, setActiveTab, environmentName, globalHeaders, pollState]);

  const loadInstances = useCallback(async () => {
    if (!domain || !workflowKey) return;
    setInstanceListLoading(true);
    try {
      const response = await QuickRunApi.listInstances({
        domain,
        workflowKey,
        page: 1,
        pageSize: 20,
        filter: activeFilter,
        orderBy: activeOrderBy,
        headers: globalHeaders,
      });
      if (response.success) {
        setInstanceList(response.data.items);
      }
    } catch {
      /* network error — keep existing list */
    }
    setInstanceListLoading(false);
  }, [domain, workflowKey, globalHeaders, activeFilter, activeOrderBy, setInstanceList, setInstanceListLoading]);

  const handleFilterApply = useCallback((filter?: string, orderBy?: string) => {
    setActiveFilter(filter);
    setActiveOrderBy(orderBy);
  }, []);

  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  const activeInstances = Array.from(instances.values()).filter((i) => i.status === 'A' || i.status === 'B');
  const completedInstances = Array.from(instances.values()).filter((i) => i.status === 'C' || i.status === 'F');

  return (
    <aside className="flex h-full w-full flex-col bg-[var(--vscode-sideBar-background)]">
      <header className="flex items-center justify-between border-b border-[var(--vscode-panel-border)] px-3 py-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--vscode-sideBarTitle-foreground)]">
          Flow Instances
        </h2>
        <div className="flex items-center gap-1">
          <button
            className={`flex h-5 w-5 items-center justify-center rounded hover:bg-[var(--vscode-list-hoverBackground)] ${
              showFilter || activeFilter ? 'text-[var(--vscode-textLink-foreground)]' : 'text-[var(--vscode-foreground)]'
            }`}
            title="Filter & Sort"
            onClick={() => setShowFilter((v) => !v)}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6 10.5a.5.5 0 01.5-.5h3a.5.5 0 010 1h-3a.5.5 0 01-.5-.5zm-2-3a.5.5 0 01.5-.5h7a.5.5 0 010 1h-7a.5.5 0 01-.5-.5zm-2-3a.5.5 0 01.5-.5h11a.5.5 0 010 1h-11a.5.5 0 01-.5-.5z"/>
            </svg>
          </button>
          <button
            className="flex h-5 w-5 items-center justify-center rounded text-[var(--vscode-foreground)] hover:bg-[var(--vscode-list-hoverBackground)]"
            title="Refresh instances"
            onClick={loadInstances}
          >
            ↻
          </button>
        </div>
      </header>

      {showFilter && (
        <InstanceFilterPanel
          onApply={handleFilterApply}
          onClose={() => setShowFilter(false)}
        />
      )}

      <div className="flex-1 overflow-y-auto px-1 py-2">
        {activeInstances.length > 0 && (
          <section>
            <h3 className="px-2 pb-1 text-[10px] font-semibold uppercase text-[var(--vscode-descriptionForeground)]">
              Active
            </h3>
            {activeInstances.map((instance) => (
              <button
                key={instance.id}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs ${
                  activeTabId === instance.id
                    ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'
                    : 'hover:bg-[var(--vscode-list-hoverBackground)]'
                }`}
                onClick={() => setActiveTab(instance.id)}
              >
                <div className="flex-1 truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium">{instance.workflowKey}</span>
                    {instance.environmentName && <EnvBadge name={instance.environmentName} />}
                  </div>
                  <div className="text-[10px] text-[var(--vscode-descriptionForeground)]">
                    {instance.currentState ?? 'Starting...'}
                  </div>
                </div>
                <StatusBadge status={instance.status} compact />
              </button>
            ))}
          </section>
        )}

        {completedInstances.length > 0 && (
          <section className="mt-3">
            <h3 className="px-2 pb-1 text-[10px] font-semibold uppercase text-[var(--vscode-descriptionForeground)]">
              Completed
            </h3>
            {completedInstances.map((instance) => (
              <button
                key={instance.id}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs opacity-70 ${
                  activeTabId === instance.id
                    ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'
                    : 'hover:bg-[var(--vscode-list-hoverBackground)]'
                }`}
                onClick={() => setActiveTab(instance.id)}
              >
                <div className="flex-1 truncate">
                  <span className="truncate">{instance.workflowKey}</span>
                </div>
                <StatusBadge status={instance.status} compact />
              </button>
            ))}
          </section>
        )}

        {instanceListLoading && (
          <div className="flex items-center justify-center py-4 text-xs text-[var(--vscode-descriptionForeground)]">
            Loading...
          </div>
        )}

        {!instanceListLoading && activeInstances.length === 0 && completedInstances.length === 0 && instanceList.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-xs text-[var(--vscode-descriptionForeground)]">
            <p>No flow instances yet</p>
            <p className="text-[10px]">Start a run to begin</p>
          </div>
        )}

        {instanceList.length > 0 && (
          <section className="mt-3">
            <h3 className="px-2 pb-1 text-[10px] font-semibold uppercase text-[var(--vscode-descriptionForeground)]">
              Recent ({environmentName ?? 'All'})
            </h3>
            {instanceList.map((item) => (
              <button
                key={item.id}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs ${
                  activeTabId === item.id
                    ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]'
                    : 'hover:bg-[var(--vscode-list-hoverBackground)]'
                }`}
                onClick={() => openInstance(item)}
              >
                <div className="flex-1 truncate">
                  <span className="truncate">{item.key.slice(0, 8)}</span>
                  <div className="text-[10px] text-[var(--vscode-descriptionForeground)]">
                    {item.metadata.currentState}
                  </div>
                  {item.metadata.createdAt && (
                    <div className="text-[9px] text-[var(--vscode-descriptionForeground)] opacity-70">
                      {new Date(item.metadata.createdAt).toLocaleString()}
                    </div>
                  )}
                </div>
                <StatusBadge status={item.metadata.status} compact />
              </button>
            ))}
          </section>
        )}
      </div>
    </aside>
  );
}
