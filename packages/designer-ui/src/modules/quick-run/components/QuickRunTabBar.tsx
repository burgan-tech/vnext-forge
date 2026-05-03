import { useQuickRunStore } from '../store/quickRunStore';
import { EnvBadge } from './EnvBadge';

export function QuickRunTabBar() {
  const tabs = useQuickRunStore((s) => s.tabs);
  const activeTabId = useQuickRunStore((s) => s.activeTabId);
  const setActiveTab = useQuickRunStore((s) => s.setActiveTab);
  const removeTab = useQuickRunStore((s) => s.removeTab);

  if (tabs.length <= 1) return null;

  return (
    <div
      className="flex items-center gap-0 overflow-x-auto border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-editorGroupHeader-tabsBackground)]"
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.instanceId}
          role="tab"
          aria-selected={tab.instanceId === activeTabId}
          tabIndex={tab.instanceId === activeTabId ? 0 : -1}
          className={`group flex items-center gap-1.5 border-r border-[var(--vscode-panel-border)] px-3 py-1.5 text-xs focus-visible:outline focus-visible:outline-[var(--vscode-focusBorder)] ${
            tab.instanceId === activeTabId
              ? 'border-b-2 border-b-[var(--vscode-tab-activeBorderTop)] bg-[var(--vscode-tab-activeBackground)] text-[var(--vscode-tab-activeForeground)]'
              : 'text-[var(--vscode-tab-inactiveForeground)] hover:bg-[var(--vscode-tab-hoverBackground)]'
          }`}
          onClick={() => setActiveTab(tab.instanceId)}
        >
          <span className="truncate max-w-[120px]">{tab.label}</span>
          {tab.environmentName && <EnvBadge name={tab.environmentName} />}
          <span
            role="button"
            tabIndex={0}
            className="ml-1 hidden h-4 w-4 items-center justify-center rounded text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-foreground)] group-hover:inline-flex group-focus-within:inline-flex"
            onClick={(e) => {
              e.stopPropagation();
              removeTab(tab.instanceId);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                removeTab(tab.instanceId);
              }
            }}
            aria-label={`Close ${tab.label}`}
          >
            ×
          </span>
        </button>
      ))}
    </div>
  );
}
