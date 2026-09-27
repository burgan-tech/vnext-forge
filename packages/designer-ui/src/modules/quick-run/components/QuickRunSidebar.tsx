import { useState } from 'react';

import type { OpenSubFlowTarget } from '../types/quickrun.types';
import { HumanTasksPanel } from './HumanTasksPanel';
import { InstanceListPanel } from './InstanceListPanel';

type SidebarTab = 'instances' | 'humanTasks';

const SIDEBAR_TABS: { id: SidebarTab; label: string }[] = [
  { id: 'instances', label: 'Instances' },
  { id: 'humanTasks', label: 'Human Tasks' },
];

/** Left pane: flow instances, or the human tasks waiting for the current role. */
export function QuickRunSidebar({ onOpenSubFlowTarget }: { onOpenSubFlowTarget?: (target: OpenSubFlowTarget) => void }) {
  const [tab, setTab] = useState<SidebarTab>('instances');
  return (
    <div className="flex h-full flex-col bg-[var(--vscode-sideBar-background)]">
      <div className="flex border-b border-[var(--vscode-panel-border)]" role="tablist" aria-label="Quick Run sidebar">
        {SIDEBAR_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`flex-1 px-2 py-1.5 text-[11px] font-medium ${
              tab === t.id
                ? 'border-b-2 border-b-[var(--vscode-focusBorder)] text-[var(--vscode-foreground)]'
                : 'text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {tab === 'instances' ? (
          <InstanceListPanel />
        ) : (
          <HumanTasksPanel {...(onOpenSubFlowTarget ? { onOpenSubFlowTarget } : {})} />
        )}
      </div>
    </div>
  );
}
