import { useCallback, useEffect, useRef } from 'react';
import Editor, { type OnMount, type Monaco } from '@monaco-editor/react';
import type { editor, IDisposable } from 'monaco-editor';

import { useUIStore } from '@app/store/useUiStore';
import { useEditorStore } from '@modules/code-editor/EditorStore';
import { useSaveFile } from '@modules/code-editor/useSaveFile';
import {
  useComponentFileTypesStore,
  flowToComponentType,
} from '@app/store/useComponentFileTypesStore';
import { useProjectStore } from '@app/store/useProjectStore';
import { useEditorValidationStore, type EditorMarkerIssue } from '@app/store/useEditorValidationStore';
import { Alert, AlertDescription } from '@shared/ui/Alert';
import { setupMonacoWithLsp } from './MonacoSetup';
import type { CsharpLspClient } from './lspClient';
import { configureJsonSchemaValidation } from './JsonSchemaSetup';

function updateComponentFileTypeFromContent(filePath: string, content: string): void {
  const projectPath = useProjectStore.getState().activeProject?.path;
  if (!projectPath) return;

  const normalized = filePath.replace(/\\/g, '/');
  const normalizedProject = projectPath.replace(/\\/g, '/');
  if (!normalized.startsWith(normalizedProject)) return;

  const relativePath = normalized.slice(normalizedProject.length).replace(/^\//, '');
  const componentsRoot = useProjectStore.getState().vnextConfig?.paths?.componentsRoot;
  if (!componentsRoot || !relativePath.startsWith(componentsRoot)) return;

  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const flow = typeof parsed.flow === 'string' ? parsed.flow : null;
    const componentType = flow ? flowToComponentType(flow) : null;
    const store = useComponentFileTypesStore.getState();
    const current = store.fileTypes[relativePath];

    if (componentType && current !== componentType) {
      store.setFileType(relativePath, componentType);
    } else if (!componentType && current) {
      store.setFileType(relativePath, null);
    }
  } catch {
    // Non-parseable JSON, skip silently
  }
}

function markerSeverityToString(severity: number): 'error' | 'warning' | 'info' {
  if (severity === 8) return 'error';
  if (severity === 4) return 'warning';
  return 'info';
}

export function CodeEditorPanel() {
  const { tabs, activeTabId, updateTabContent, closeTab, setActiveTab } = useEditorStore();
  const { theme: uiTheme } = useUIStore();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const lspClientRef = useRef<CsharpLspClient | null>(null);
  const lspSessionId = useRef(crypto.randomUUID());
  const markerListenerRef = useRef<IDisposable | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const vnextConfig = useProjectStore((s) => s.vnextConfig);

  const monacoEditorTheme = uiTheme === 'dark' ? 'vs-dark' : 'vs';

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
      const monacoEditor = editorRef.current;
      const raw = monacoEditor?.getValue() ?? useEditorStore.getState().tabs.find((t) => t.id === id)?.content;
      if (raw === undefined) return;
      useEditorStore.getState().updateTabContent(id, raw);
      useEditorStore.getState().markTabClean(id);

      const tab = useEditorStore.getState().tabs.find((t) => t.id === id);
      if (tab?.filePath && tab.language === 'json') {
        updateComponentFileTypeFromContent(tab.filePath, raw);
      }
    },
  });

  useEffect(() => {
    return () => {
      markerListenerRef.current?.dispose();
      lspClientRef.current?.dispose();
      lspClientRef.current = null;
      useEditorValidationStore.getState().clearMarkers();
    };
  }, []);

  useEffect(() => {
    if (monacoRef.current) {
      void configureJsonSchemaValidation(monacoRef.current, vnextConfig?.paths ?? null);
    }
  }, [vnextConfig?.paths]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    if (!lspClientRef.current) {
      void setupMonacoWithLsp(monaco, lspSessionId.current).then((client) => {
        lspClientRef.current = client;
      });
    }

    markerListenerRef.current?.dispose();
    markerListenerRef.current = monaco.editor.onDidChangeMarkers(() => {
      const model = editor.getModel();
      if (!model) return;

      const markers = monaco.editor.getModelMarkers({ resource: model.uri });
      const issues: EditorMarkerIssue[] = markers.map((marker: editor.IMarker) => ({
        severity: markerSeverityToString(marker.severity),
        message: marker.message,
        startLineNumber: marker.startLineNumber,
        startColumn: marker.startColumn,
        endLineNumber: marker.endLineNumber,
        endColumn: marker.endColumn,
      }));

      const filePath = activeTab?.filePath ?? model.uri.toString();
      useEditorValidationStore.getState().setActiveFileMarkers(filePath, issues);
    });
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
            value={activeTab.content ?? ''}
            theme={monacoEditorTheme}
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
