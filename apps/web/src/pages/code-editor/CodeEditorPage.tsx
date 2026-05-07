import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { Redo2, Save, Undo2 } from 'lucide-react';

import { isFailure } from '@vnext-forge-studio/app-contracts';
import {
  Button,
  readFile,
  setupMonacoWithLsp,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useEditorStore,
  useProjectStore,
  writeFile,
  type CsharpLspClient,
  type EditorTab,
} from '@vnext-forge-studio/designer-ui';

import {
  flowToComponentType,
  useComponentFileTypesStore,
} from '../../app/store/useComponentFileTypesStore';
import { getProject } from '../../modules/project-management/ProjectApi';
import { ENABLE_COMPONENT_FLOW_ICONS } from '../../modules/project-workspace/componentFlowIconsPolicy';
import { syncVnextWorkspaceFromDisk } from '../../modules/project-workspace/syncVnextWorkspaceFromDisk';
import { validateVnextConfigJsonText } from '../../modules/project-workspace/vnextWorkspaceConfigWizardValidation';
import { applyVnextConfigStrictValidationFailure } from '../../modules/project-workspace/workspaceConfigDiagnostics';
import { useCodeEditorToolbar } from '../../modules/project-workspace/CodeEditorToolbarContext';

function updateComponentFileTypeAfterSave(filePath: string, content: string): void {
  if (!ENABLE_COMPONENT_FLOW_ICONS) return;
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

function getMonacoUndoRedoState(ed: editor.IStandaloneCodeEditor): {
  canUndo: boolean;
  canRedo: boolean;
} {
  const model = ed.getModel() as unknown as { canUndo?: () => boolean; canRedo?: () => boolean } | null;
  if (model && typeof model.canUndo === 'function' && typeof model.canRedo === 'function') {
    return { canUndo: model.canUndo(), canRedo: model.canRedo() };
  }
  const undoAction = ed.getAction('editor.action.undo');
  const redoAction = ed.getAction('editor.action.redo');
  const isEnabled = (a: typeof undoAction) => {
    if (!a?.isSupported()) return false;
    return (a as { enabled?: boolean }).enabled !== false;
  };
  return {
    canUndo: isEnabled(undoAction),
    canRedo: isEnabled(redoAction),
  };
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
  const { setActiveProject } = useProjectStore();
  const { tabs, openTab, updateTabContent, markTabClean } = useEditorStore();
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monacoUndoRedo, setMonacoUndoRedo] = useState({ canUndo: false, canRedo: false });
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const lspClientRef = useRef<CsharpLspClient | null>(null);
  const lspSessionId = useRef(crypto.randomUUID());
  const { setToolbar } = useCodeEditorToolbar();

  const filePath = encodedFilePath ? decodeURIComponent(encodedFilePath) : null;
  const fileName = filePath?.split('/').pop() ?? 'unknown';
  const language = detectLanguage(fileName);
  const activeFileTab: EditorTab | undefined = filePath
    ? tabs.find((t) => t.kind === 'file' && t.filePath === filePath)
    : undefined;

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
    openTab({ id: filePath, kind: 'file', title: fileName, filePath, language });
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
    if (!filePath || !activeFileTab) return;
    const latest = editorRef.current?.getValue() ?? activeFileTab.content ?? '';
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
  }, [filePath, activeFileTab, id, markTabClean, updateTabContent]);

  // Dispose LSP client on unmount
  useEffect(() => {
    return () => {
      lspClientRef.current?.dispose();
      lspClientRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    const ed = editorRef.current;
    if (!ed) return;
    const update = () => {
      setMonacoUndoRedo(getMonacoUndoRedoState(ed));
    };
    update();
    const d1 = ed.onDidChangeModelContent(update);
    const d2 = ed.onDidChangeModel(update);
    return () => {
      d1.dispose();
      d2.dispose();
    };
  }, [filePath, loading]);

  const handleUndo = useCallback(() => {
    editorRef.current?.trigger('editor', 'editor.action.undo', undefined);
  }, []);

  const handleRedo = useCallback(() => {
    editorRef.current?.trigger('editor', 'editor.action.redo', undefined);
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
      setMonacoUndoRedo(getMonacoUndoRedoState(editor));
    },
    [handleSave],
  );

  useLayoutEffect(() => {
    if (loading || (error !== null && content === null)) {
      setToolbar(null);
      return;
    }
    setToolbar(
      <TooltipProvider delayDuration={300}>
        {activeFileTab?.isDirty ? (
          <span
            className="border-warning-border bg-warning-surface text-warning-text max-w-36 truncate rounded-full border px-1.5 py-px text-[9px] font-medium leading-none"
            title="Unsaved changes">
            Modified
          </span>
        ) : null}
        {saving ? (
          <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400">Saving…</span>
        ) : null}
        <span className="text-muted-foreground hidden rounded border border-border/80 bg-muted/40 px-1 py-px font-mono text-[9px] uppercase leading-none tracking-wide sm:inline">
          {language}
        </span>
        <div
          className="border-border bg-muted/30 flex items-center gap-px rounded border p-px"
          role="group"
          aria-label="History">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="muted"
                size="sm"
                className="h-6 min-h-6 min-w-6 px-0"
                aria-label="Undo (Cmd+Z)"
                disabled={!monacoUndoRedo.canUndo}
                onClick={handleUndo}>
                <Undo2 size={12} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[11px]">
              Undo (Cmd+Z)
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="muted"
                size="sm"
                className="h-6 min-h-6 min-w-6 px-0"
                aria-label="Redo (Cmd+Shift+Z)"
                disabled={!monacoUndoRedo.canRedo}
                onClick={handleRedo}>
                <Redo2 size={12} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[11px]">
              Redo (Cmd+Shift+Z)
            </TooltipContent>
          </Tooltip>
        </div>
        <Button
          type="button"
          variant="success"
          size="sm"
          className="h-6 min-h-6 gap-1 px-2 text-[11px]"
          disabled={!activeFileTab?.isDirty || saving}
          leftIconComponent={<Save size={12} />}
          onClick={() => {
            void handleSave();
          }}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </TooltipProvider>,
    );
    return () => {
      setToolbar(null);
    };
  }, [
    activeFileTab?.isDirty,
    content,
    error,
    handleRedo,
    handleSave,
    handleUndo,
    language,
    loading,
    monacoUndoRedo.canRedo,
    monacoUndoRedo.canUndo,
    saving,
    setToolbar,
  ]);

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
      <div className="min-h-0 flex-1">
        <Editor
          height="100%"
          path={filePath ?? undefined}
          language={language}
          value={activeFileTab?.content ?? content ?? ''}
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
