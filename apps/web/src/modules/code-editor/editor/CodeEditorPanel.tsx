import { useEffect, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useEditorStore } from '@modules/code-editor/EditorStore';
import { useSaveFile } from '@modules/code-editor/useSaveFile';
import { useUIStore } from '@app/store/useUiStore';
import { Alert, AlertDescription } from '@shared/ui/Alert';
import { setupMonacoWithLsp } from './MonacoSetup';
import type { CsharpLspClient } from './lspClient';

let monacoInitialized = false;

export function CodeEditorPanel() {
  const { tabs, activeTabId, updateTabContent, closeTab, setActiveTab, markTabClean } =
    useEditorStore();
  const { theme } = useUIStore();
  const editorRef = useRef<any>(null);
  const lspClientRef = useRef<CsharpLspClient | null>(null);
  const lspSessionId = useRef(crypto.randomUUID());

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const { saveError, saving } = useSaveFile({
    filePath: activeTab?.filePath ?? null,
    getContent: () => activeTab?.content ?? null,
    isDirty: activeTab?.isDirty ?? false,
    onSaved: () => {
      if (activeTab) {
        markTabClean(activeTab.id);
      }
    },
  });

  // Dispose LSP client on unmount
  useEffect(() => {
    return () => {
      lspClientRef.current?.dispose();
      lspClientRef.current = null;
    };
  }, []);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    if (!monacoInitialized) {
      monacoInitialized = true;
      setupMonacoWithLsp(monaco, lspSessionId.current).then((client) => {
        lspClientRef.current = client;
      });
    }
  };

  const getLanguage = (lang: string) => {
    switch (lang) {
      case 'csharp':
        return 'csharp';
      case 'json':
        return 'json';
      case 'markdown':
        return 'markdown';
      default:
        return 'plaintext';
    }
  };

  if (tabs.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        No files open. Select a file from the sidebar.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-border bg-muted/30 flex shrink-0 overflow-x-auto border-b">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`border-border flex cursor-pointer items-center gap-1 border-r px-3 py-1.5 text-xs ${
              tab.id === activeTabId
                ? 'bg-background text-foreground'
                : 'text-muted-foreground hover:bg-muted/50'
            }`}
            onClick={() => setActiveTab(tab.id)}>
            <span className="max-w-[120px] truncate">{tab.title}</span>
            {tab.isDirty && <span className="text-primary">●</span>}
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className="hover:text-foreground ml-1">
              ×
            </button>
          </div>
        ))}

        {saving && (
          <div className="text-muted-foreground ml-auto flex items-center px-3 text-xs">
            Saving...
          </div>
        )}
      </div>

      {saveError && (
        <div className="shrink-0 p-3 pb-0">
          <Alert variant="destructive" className="px-3 py-2 text-xs">
            <AlertDescription>{saveError.toUserMessage().message}</AlertDescription>
          </Alert>
        </div>
      )}

      {activeTab && (
        <div className="flex-1">
          <Editor
            height="100%"
            path={activeTab.id}
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
