import { useCallback, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useEditorStore } from '@modules/code-editor/EditorStore';
import { useSaveFile } from '@modules/code-editor/useSaveFile';
import { Alert, AlertDescription } from '@shared/ui/Alert';
import { setupMonaco } from './MonacoSetup';

let monacoInitialized = false;

export function CodeEditorPanel() {
  const { tabs, activeTabId, updateTabContent, closeTab, setActiveTab } = useEditorStore();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const getLatestEditorContent = useCallback((): string | null => {
    const fromMonaco = editorRef.current?.getValue();
    if (typeof fromMonaco === 'string') {
      return fromMonaco;
    }
    return activeTab?.content ?? null;
  }, [activeTab?.content]);

  const { saveError, saving } = useSaveFile({
    filePath: activeTab?.filePath ?? null,
    getContent: getLatestEditorContent,
    isDirty: activeTab?.isDirty ?? false,
    onSaved: () => {
      const id = useEditorStore.getState().activeTabId;
      if (!id) return;
      const editor = editorRef.current;
      const raw = editor?.getValue() ?? useEditorStore.getState().tabs.find((t) => t.id === id)?.content;
      if (raw === undefined) return;
      useEditorStore.getState().updateTabContent(id, raw);
      useEditorStore.getState().markTabClean(id);
    },
  });

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    if (!monacoInitialized) {
      setupMonaco(monaco);
      monacoInitialized = true;
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
            language={getLanguage(activeTab.language)}
            value={activeTab.content ?? ''}
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
