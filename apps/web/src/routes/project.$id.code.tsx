import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useEditorStore } from '../stores/editor-store';
import { useProjectStore } from '../stores/project-store';
import { setupMonaco } from '../editor/MonacoSetup';

let monacoInitialized = false;

function detectLanguage(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'json': return 'json';
    case 'csx': case 'cs': return 'csharp';
    case 'js': return 'javascript';
    case 'ts': return 'typescript';
    case 'xml': return 'xml';
    case 'yaml': case 'yml': return 'yaml';
    case 'md': return 'markdown';
    case 'html': return 'html';
    case 'css': return 'css';
    case 'sql': return 'sql';
    case 'sh': case 'bash': return 'shell';
    case 'http': return 'http';
    case 'py': return 'python';
    default: return 'plaintext';
  }
}

export function CodeEditorPage() {
  const { id, '*': encodedFilePath } = useParams<{ id: string; '*': string }>();
  const navigate = useNavigate();
  const { activeProject } = useProjectStore();
  const { tabs, activeTabId, openTab, updateTabContent, markTabClean, setActiveTab, closeTab } = useEditorStore();
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<any>(null);

  const filePath = encodedFilePath ? decodeURIComponent(encodedFilePath) : null;
  const fileName = filePath?.split('/').pop() || 'unknown';
  const language = detectLanguage(fileName);
  const activeTab = tabs.find((t) => t.id === activeTabId);

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
      const res = await fetch(`/api/files?path=${encodeURIComponent(fp)}`);
      if (!res.ok) throw new Error('File not found');
      const data = await res.json();
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
    setSaving(true);
    try {
      const res = await fetch('/api/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content: activeTab.content }),
      });
      if (!res.ok) throw new Error('Save failed');
      markTabClean(filePath);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }, [filePath, activeTab, markTabClean]);

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    if (!monacoInitialized) {
      setupMonaco(monaco);
      monacoInitialized = true;
    }
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave();
    });
  }, [handleSave]);

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) {
      navigate(`/project/${id}/code/${encodeURIComponent(tab.filePath)}`, { replace: true });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        Loading file...
      </div>
    );
  }

  if (error && content === null) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <div className="text-red-500 text-sm">{error}</div>
        <button onClick={() => navigate(`/project/${id}`)} className="text-xs text-slate-400 hover:text-slate-900">
          Back to project
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      {tabs.length > 0 && (
        <div className="flex border-b border-slate-200 bg-slate-50/50 overflow-x-auto shrink-0">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer border-r border-slate-100 min-w-0 ${
                tab.id === activeTabId
                  ? 'bg-white text-slate-900 font-medium'
                  : 'text-slate-500 hover:bg-slate-100/50 hover:text-slate-700'
              }`}
              onClick={() => handleTabClick(tab.id)}
            >
              <FileIcon language={tab.language} />
              <span className="truncate max-w-[140px]">{tab.title}</span>
              {tab.isDirty && <span className="text-amber-500 text-[10px]">●</span>}
              <button
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                className="ml-0.5 text-slate-300 hover:text-slate-600 shrink-0"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="border-b border-slate-100 px-3 py-1 flex items-center gap-2 text-[11px] shrink-0 bg-white">
        <button onClick={() => navigate(`/project/${id}`)} className="text-slate-400 hover:text-slate-700">
          {activeProject?.domain || id}
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-slate-500 truncate">
          {filePath?.replace((activeProject?.path || '') + '/', '') || fileName}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {activeTab?.isDirty && <span className="text-amber-500 text-[10px] font-medium">Modified</span>}
          {saving && <span className="text-indigo-500 text-[10px] font-medium">Saving...</span>}
          <span className="text-slate-400 uppercase font-mono text-[10px]">{language}</span>
        </div>
      </div>

      {/* Monaco */}
      <div className="flex-1">
        <Editor
          height="100%"
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
    csharp: 'text-violet-500', json: 'text-amber-500', javascript: 'text-yellow-500',
    typescript: 'text-blue-500', sql: 'text-orange-500', shell: 'text-green-500',
    markdown: 'text-slate-500', yaml: 'text-red-400', xml: 'text-orange-400',
    html: 'text-red-500', css: 'text-blue-400', python: 'text-blue-600',
  };
  const labels: Record<string, string> = {
    csharp: 'C#', json: '{}', javascript: 'JS', typescript: 'TS',
    sql: 'SQL', shell: 'SH', markdown: 'MD', yaml: 'YML',
    xml: 'XML', html: 'HT', css: 'CSS', python: 'PY',
  };
  return (
    <span className={`text-[9px] font-bold ${colors[language] || 'text-slate-400'} w-4 text-center shrink-0`}>
      {labels[language] || '~'}
    </span>
  );
}
