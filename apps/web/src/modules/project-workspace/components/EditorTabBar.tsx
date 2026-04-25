import { EditorTabLabel, type EditorTab } from '@vnext-forge/designer-ui';

function FileIcon({ language }: { language: string }) {
  const colors: Record<string, string> = {
    csharp: 'text-violet-500',
    json: 'text-amber-500',
    javascript: 'text-yellow-500',
    typescript: 'text-blue-500',
    sql: 'text-orange-500',
    shell: 'text-green-500',
    markdown: 'text-slate-500',
    yaml: 'text-red-400',
    xml: 'text-orange-400',
    html: 'text-red-500',
    css: 'text-blue-400',
    python: 'text-blue-600',
  };

  const labels: Record<string, string> = {
    csharp: 'C#',
    json: '{}',
    javascript: 'JS',
    typescript: 'TS',
    sql: 'SQL',
    shell: 'SH',
    markdown: 'MD',
    yaml: 'YML',
    xml: 'XML',
    html: 'HT',
    css: 'CSS',
    python: 'PY',
  };

  return (
    <span
      className={`w-4 shrink-0 text-center text-[9px] font-bold ${colors[language] || 'text-slate-400'}`}>
      {labels[language] || '~'}
    </span>
  );
}

interface EditorTabBarProps {
  tabs: EditorTab[];
  activeTabId: string | null;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
}

export function EditorTabBar({ tabs, activeTabId, onTabClick, onTabClose }: EditorTabBarProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="flex min-w-0 flex-1 overflow-x-auto">
      {tabs.map((tab) => (
          <div
            key={tab.id}
            role="tab"
            className={`flex min-h-0 min-w-0 cursor-pointer items-center gap-1 border-r border-border/70 px-2.5 py-1 text-[11px] leading-tight transition-colors duration-150 ${
              tab.id === activeTabId
                ? 'bg-background border-b-2 border-b-primary font-medium text-foreground'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
            onClick={() => onTabClick(tab.id)}
            onMouseDown={(event) => {
              if (event.button === 1) {
                event.preventDefault();
              }
            }}
            onAuxClick={(event) => {
              if (event.button === 1) {
                event.preventDefault();
                event.stopPropagation();
                onTabClose(tab.id);
              }
            }}>
            <EditorTabLabel
              tab={tab}
              titleClassName="max-w-[140px] truncate"
              renderFileLeading={(language) => <FileIcon language={language} />}
            />
            {tab.isDirty && <span className="text-[10px] font-medium text-amber-600">*</span>}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onTabClose(tab.id);
              }}
              className="text-muted-foreground hover:text-foreground ml-0.5 shrink-0 rounded px-0.5 transition-colors">
              ×
            </button>
          </div>
        ))}
    </div>
  );
}
