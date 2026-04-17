import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

import { isFailure } from '@vnext-forge/app-contracts';
import {
  readFile,
  setupMonacoWithLsp,
  useEditorStore,
  useProjectStore,
  writeFile,
  type CsharpLspClient,
} from '@vnext-forge/designer-ui';

import {
  flowToComponentType,
  useComponentFileTypesStore,
} from '../../app/store/useComponentFileTypesStore';
import { getProject } from '../../modules/project-management/ProjectApi';
import { syncVnextWorkspaceFromDisk } from '../../modules/project-workspace/syncVnextWorkspaceFromDisk';
import { validateVnextConfigJsonText } from '../../modules/project-workspace/vnextWorkspaceConfigWizardValidation';
import { applyVnextConfigStrictValidationFailure } from '../../modules/project-workspace/workspaceConfigDiagnostics';

function updateComponentFileTypeAfterSave(filePath: string, content: string): void {
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
    // Non-parseable JSON
  }
}

function isVnextConfigFilePath(p: string): boolean {
  const n = p.replace(/\\/g, '/').toLowerCase();
  return n.endsWith('/vnext.config.json') || n === 'vnext.config.json';
}

function detectLanguage(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'json':
      return 'json';
    case 'csx':
    case 'cs':
      return 'csharp';
    case 'js':
      return 'javascript';
    case 'ts':
      return 'typescript';
    case 'xml':
      return 'xml';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'md':
      return 'markdown';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'sql':
      return 'sql';
    case 'sh':
    case 'bash':
      return 'shell';
    case 'http':
      return 'http';
    case 'py':
      return 'python';
    default:
      return 'plaintext';
  }
}

export function CodeEditorPage() {
  const { id, '*': encodedFilePath } = useParams<{ id: string; '*': string }>();
  const navigate = useNavigate();
  const { activeProject, setActiveProject } = useProjectStore();
  const { tabs, activeTabId, openTab, updateTabContent, markTabClean, setActiveTab, closeTab } =
    useEditorStore();
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const lspClientRef = useRef<CsharpLspClient | null>(null);
  const lspSessionId = useRef(crypto.randomUUID());

  const filePath = encodedFilePath ? decodeURIComponent(encodedFilePath) : null;
  const fileName = filePath?.split('/').pop() ?? 'unknown';
  const language = detectLanguage(fileName);
  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      if (useProjectStore.getState().activeProject?.id !== id) {
        const res = await getProject(id);
        if (cancelled || !res.success) return;
        setActiveProject(res.data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, setActiveProject]);

  useEffect(() => {
    if (!filePath) return;
    openTab({ id: filePath, title: fileName, filePath, language });
  }, [filePath]);

  useEffect(() => {
    if (!filePath) return;
    loadFile(filePath);
  }, [filePath]);

  async function loadFile(fp: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await readFile(fp);
      setContent(data.content);
      updateTabContent(fp, data.content);
      markTabClean(fp);
    } catch (err) {
      setError(String(err));
      setContent(null);
    } finally {
      setLoading(false);
    }
  }

  const handleSave = useCallback(async () => {
    if (!filePath || !activeTab) return;
    const latest = editorRef.current?.getValue() ?? activeTab.content ?? '';
    setSaving(true);
    setError(null);
    try {
      const result = await writeFile(filePath, latest);
      if (isFailure(result)) {
        setError(result.error.message);
        return;
      }
      updateTabContent(filePath, latest);
      markTabClean(filePath);
      if (language === 'json') {
        updateComponentFileTypeAfterSave(filePath, latest);
      }
      if (id && isVnextConfigFilePath(filePath)) {
        const strict = validateVnextConfigJsonText(latest);
        if (!strict.ok) {
          applyVnextConfigStrictValidationFailure(strict.summary);
          setError(strict.summary);
          return;
        }
        const syncResult = await syncVnextWorkspaceFromDisk(id, { openWizardOnMissing: true });
        if (!syncResult.ok) {
          setError(syncResult.message);
        }
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }, [filePath, activeTab, id, markTabClean, updateTabContent]);

  // Dispose LSP client on unmount
  useEffect(() => {
    return () => {
      lspClientRef.current?.dispose();
      lspClientRef.current = null;
    };
  }, []);

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      if (!lspClientRef.current) {
        setupMonacoWithLsp(monaco, lspSessionId.current).then((client) => {
          lspClientRef.current = client;
        });
      }
      const keys = monaco as {
        KeyMod: { CtrlCmd: number };
        KeyCode: { KeyS: number };
      };
      editor.addCommand(keys.KeyMod.CtrlCmd | keys.KeyCode.KeyS, () => {
        void handleSave();
      });
    },
    [handleSave],
  );

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    const tab = tabs.find((item) => item.id === tabId);
    if (tab) {
      navigate(`/project/${id}/code/${encodeURIComponent(tab.filePath)}`, { replace: true });
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        Loading file...
      </div>
    );
  }

  if (error && content === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <div className="text-sm text-red-500">{error}</div>
        <button
          type="button"
          onClick={() => {
            void navigate(`/project/${id}`);
          }}
          className="text-xs text-slate-400 hover:text-slate-900">
          Back to project
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {tabs.length > 0 && (
        <div className="flex shrink-0 overflow-x-auto border-b border-slate-200 bg-slate-50/50">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`flex min-w-0 cursor-pointer items-center gap-1.5 border-r border-slate-100 px-3 py-1.5 text-xs ${
                tab.id === activeTabId
                  ? 'bg-white font-medium text-slate-900'
                  : 'text-slate-500 hover:bg-slate-100/50 hover:text-slate-700'
              }`}
              onClick={() => handleTabClick(tab.id)}>
              <FileIcon language={tab.language} />
              <span className="max-w-[140px] truncate">{tab.title}</span>
              {tab.isDirty && <span className="text-[10px] text-amber-500">*</span>}
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  closeTab(tab.id);
                }}
                className="ml-0.5 shrink-0 text-slate-300 hover:text-slate-600">
                x
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 bg-white px-3 py-1 text-[11px]">
        <button
          type="button"
          onClick={() => {
            void navigate(`/project/${id}`);
          }}
          className="text-slate-400 hover:text-slate-700">
          {activeProject?.domain ?? id}
        </button>
        <span className="text-slate-300">/</span>
        <span className="truncate text-slate-500">
          {filePath?.replace(`${activeProject?.path ?? ''}/`, '') ?? fileName}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {activeTab?.isDirty && (
            <span className="text-[10px] font-medium text-amber-500">Modified</span>
          )}
          {saving && <span className="text-[10px] font-medium text-indigo-500">Saving...</span>}
          <span className="font-mono text-[10px] text-slate-400 uppercase">{language}</span>
        </div>
      </div>

      <div className="flex-1">
        <Editor
          height="100%"
          path={filePath ?? undefined}
          language={language}
          value={activeTab?.content ?? content ?? ''}
          theme="vs"
          onChange={(value) => {
            if (value !== undefined && filePath) {
              updateTabContent(filePath, value);
            }
          }}
          onMount={handleMount}
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            minimap: { enabled: true, scale: 2 },
            wordWrap: 'on',
            lineNumbers: 'on',
            renderWhitespace: 'selection',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            suggestOnTriggerCharacters: true,
            smoothScrolling: true,
            cursorSmoothCaretAnimation: 'on',
            cursorBlinking: 'smooth',
            bracketPairColorization: { enabled: true },
            padding: { top: 12 },
            overviewRulerBorder: false,
            scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
          }}
        />
      </div>
    </div>
  );
}

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
