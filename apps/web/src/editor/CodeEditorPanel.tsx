import { useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useEditorStore } from '../stores/editor-store';
import { useUIStore } from '../stores/ui-store';
import { setupMonaco } from './MonacoSetup';

let monacoInitialized = false;

export function CodeEditorPanel() {
  const { tabs, activeTabId, updateTabContent, closeTab, setActiveTab } = useEditorStore();
  const { theme } = useUIStore();
  const editorRef = useRef<any>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    if (!monacoInitialized) {
      setupMonaco(monaco);
      monacoInitialized = true;
    }
  };

  const getLanguage = (lang: string) => {
    switch (lang) {
      case 'csharp': return 'csharp';
      case 'json': return 'json';
      case 'markdown': return 'markdown';
      default: return 'plaintext';
    }
  };

  if (tabs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        No files open. Select a file from the sidebar.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-border bg-muted/30 overflow-x-auto shrink-0">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs cursor-pointer border-r border-border ${
              tab.id === activeTabId
                ? 'bg-background text-foreground'
                : 'text-muted-foreground hover:bg-muted/50'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="truncate max-w-[120px]">{tab.title}</span>
            {tab.isDirty && <span className="text-primary">●</span>}
            <button
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
              className="ml-1 hover:text-foreground"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {activeTab && (
        <div className="flex-1">
          <Editor
            height="100%"
            language={getLanguage(activeTab.language)}
            value={activeTab.content || ''}
            theme="vs"
            onChange={(value) => {
              if (value !== undefined) {
                updateTabContent(activeTab.id, value);
              }
            }}
            onMount={handleMount}
            options={{
              fontSize: 13,
              fontFamily: 'var(--font-mono)',
              minimap: { enabled: true },
              wordWrap: 'on',
              lineNumbers: 'on',
              renderWhitespace: 'selection',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              suggestOnTriggerCharacters: true,
            }}
          />
        </div>
      )}
    </div>
  );
}
