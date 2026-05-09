import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { BookOpen, Columns2, FileCode, Redo2, Save, Undo2 } from 'lucide-react';

import { isFailure } from '@vnext-forge-studio/app-contracts';
import {
  Button,
  cn,
  readFile,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  setupMonacoWithLsp,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useEditorStore,
  useGroupRef,
  useProjectStore,
  useResolvedColorTheme,
  writeFile,
  type CsharpLspClient,
  type EditorTab,
} from '@vnext-forge-studio/designer-ui';

import { DebouncedMarkdownPreview, MarkdownPreview } from '../../modules/code-editor/MarkdownPreview';
import type { MarkdownPreviewMode } from '../../modules/code-editor/markdownPreviewMode';

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

const MARKDOWN_EDITOR_PANEL_ID = 'code-editor-markdown-pane';
const MARKDOWN_PREVIEW_PANEL_ID = 'code-editor-markdown-preview-pane';

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

function tryApplyWorkspaceSearchHitNavigation(opts: {
  editor: editor.IStandaloneCodeEditor;
  filePath: string;
  searchParams: URLSearchParams;
  setSearchParams: (next: URLSearchParams, init?: { replace?: boolean }) => void;
  appliedKeyRef: MutableRefObject<string | null>;
}): void {
  const { editor: ed, filePath, searchParams, setSearchParams, appliedKeyRef } = opts;
  const lineRaw = searchParams.get('line');
  if (lineRaw === null) return;

  const colRaw = searchParams.get('column');
  const lenRaw = searchParams.get('matchLen');
  const lineNum = Number.parseInt(lineRaw, 10);
  const colNum = colRaw !== null && colRaw !== '' ? Number.parseInt(colRaw, 10) : 1;
  const matchLen = lenRaw !== null && lenRaw !== '' ? Number.parseInt(lenRaw, 10) : 0;

  if (Number.isNaN(lineNum) || lineNum < 1 || Number.isNaN(colNum) || colNum < 1) return;

  const revealKey = `${filePath}:${lineNum}:${colNum}:${matchLen}`;
  if (appliedKeyRef.current === revealKey) return;

  const model = ed.getModel();
  if (!model) return;

  const maxCol = Math.max(1, model.getLineMaxColumn(lineNum));
  const safeStart = Math.min(colNum, maxCol);
  const endPreferred = matchLen > 0 ? colNum + matchLen : colNum;
  const safeEnd = Math.min(Math.max(safeStart, endPreferred), maxCol);

  ed.revealLineInCenter(lineNum);
  if (matchLen > 0 && safeEnd > safeStart) {
    ed.setSelection({
      startLineNumber: lineNum,
      startColumn: safeStart,
      endLineNumber: lineNum,
      endColumn: safeEnd,
    });
  } else {
    ed.setPosition({ lineNumber: lineNum, column: safeStart });
  }

  appliedKeyRef.current = revealKey;

  const next = new URLSearchParams(searchParams);
  next.delete('line');
  next.delete('column');
  next.delete('matchLen');
  setSearchParams(next, { replace: true });
}

export function CodeEditorPage() {
  const { id, '*': encodedFilePath } = useParams<{ id: string; '*': string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const searchHitNavAppliedRef = useRef<string | null>(null);
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;
  const { setToolbar } = useCodeEditorToolbar();
  const resolvedColorTheme = useResolvedColorTheme();
  const monacoTheme = resolvedColorTheme === 'dark' ? 'vs-dark' : 'vs';
  const markdownLayoutGroupRef = useGroupRef();
  const [markdownPreviewMode, setMarkdownPreviewMode] = useState<MarkdownPreviewMode>('edit');

  const filePath = encodedFilePath ? decodeURIComponent(encodedFilePath) : null;
  const fileName = filePath?.split('/').pop() ?? 'unknown';
  const language = detectLanguage(fileName);
  const isMarkdownDoc = language === 'markdown';
  const activeFileTab: EditorTab | undefined = filePath
    ? tabs.find((t) => t.kind === 'file' && t.filePath === filePath)
    : undefined;
  const liveMarkdownSource = activeFileTab?.content ?? content ?? '';

  const markdownPanelsDefaultLayout = useMemo(
    () => ({
      [MARKDOWN_EDITOR_PANEL_ID]: 100,
      [MARKDOWN_PREVIEW_PANEL_ID]: 0,
    }),
    [],
  );

  useEffect(() => {
    searchHitNavAppliedRef.current = null;
    // eslint-disable-next-line react-x/set-state-in-effect -- reset markdown preview mode when opening another file
    setMarkdownPreviewMode('edit');
  }, [filePath]);

  useLayoutEffect(() => {
    if (!isMarkdownDoc || loading) return;
    const group = markdownLayoutGroupRef.current;
    if (!group) return;
    const layout =
      markdownPreviewMode === 'edit'
        ? { [MARKDOWN_EDITOR_PANEL_ID]: 100, [MARKDOWN_PREVIEW_PANEL_ID]: 0 }
        : markdownPreviewMode === 'preview'
          ? { [MARKDOWN_EDITOR_PANEL_ID]: 0, [MARKDOWN_PREVIEW_PANEL_ID]: 100 }
          : { [MARKDOWN_EDITOR_PANEL_ID]: 52, [MARKDOWN_PREVIEW_PANEL_ID]: 48 };
    group.setLayout(layout);
  }, [isMarkdownDoc, loading, markdownPreviewMode, filePath, markdownLayoutGroupRef]);

  const applyWorkspaceSearchHitFromUrl = useCallback(
    (ed: editor.IStandaloneCodeEditor) => {
      if (!filePath) return;
      tryApplyWorkspaceSearchHitNavigation({
        editor: ed,
        filePath,
        searchParams: searchParamsRef.current,
        setSearchParams,
        appliedKeyRef: searchHitNavAppliedRef,
      });
    },
    [filePath, setSearchParams],
  );

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

  useEffect(() => {
    if (loading || !filePath || !searchParams.get('line')) return;
    const ed = editorRef.current;
    if (!ed) return;
    let raf1 = 0;
    let raf2 = 0;
    let cancelled = false;
    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        if (cancelled) return;
        applyWorkspaceSearchHitFromUrl(ed);
      });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [applyWorkspaceSearchHitFromUrl, filePath, loading, searchParams]);

  const handleUndo = useCallback(() => {
    editorRef.current?.trigger('editor', 'editor.action.undo', undefined);
  }, []);

  const handleRedo = useCallback(() => {
    editorRef.current?.trigger('editor', 'editor.action.redo', undefined);
  }, []);

  const handleMount: OnMount = useCallback(
    (editorInstance, monaco) => {
      editorRef.current = editorInstance;
      if (!lspClientRef.current) {
        setupMonacoWithLsp(monaco, lspSessionId.current).then((client) => {
          lspClientRef.current = client;
        });
      }
      const keys = monaco as {
        KeyMod: { CtrlCmd: number };
        KeyCode: { KeyS: number };
      };
      editorInstance.addCommand(keys.KeyMod.CtrlCmd | keys.KeyCode.KeyS, () => {
        void handleSave();
      });
      setMonacoUndoRedo(getMonacoUndoRedoState(editorInstance));

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          applyWorkspaceSearchHitFromUrl(editorInstance);
        });
      });
    },
    [applyWorkspaceSearchHitFromUrl, handleSave],
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
        {language === 'markdown' ? (
          <div
            className="border-border bg-muted/30 flex items-center gap-px rounded border p-px"
            role="toolbar"
            aria-label="Markdown preview mode">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={markdownPreviewMode === 'edit' ? 'secondary' : 'muted'}
                  size="sm"
                  className="h-6 min-h-6 min-w-6 px-0"
                  aria-label="Edit Markdown source"
                  aria-pressed={markdownPreviewMode === 'edit'}
                  onClick={() => setMarkdownPreviewMode('edit')}>
                  <FileCode size={12} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[11px]">
                Edit Markdown source
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={markdownPreviewMode === 'split' ? 'secondary' : 'muted'}
                  size="sm"
                  className="h-6 min-h-6 min-w-6 px-0"
                  aria-label="Edit and preview side by side"
                  aria-pressed={markdownPreviewMode === 'split'}
                  onClick={() => setMarkdownPreviewMode('split')}>
                  <Columns2 size={12} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[11px]">
                Edit and preview side by side
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={markdownPreviewMode === 'preview' ? 'secondary' : 'muted'}
                  size="sm"
                  className="h-6 min-h-6 min-w-6 px-0"
                  aria-label="Preview rendered Markdown"
                  aria-pressed={markdownPreviewMode === 'preview'}
                  onClick={() => setMarkdownPreviewMode('preview')}>
                  <BookOpen size={12} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[11px]">
                Preview rendered Markdown
              </TooltipContent>
            </Tooltip>
          </div>
        ) : null}
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
    markdownPreviewMode,
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

  const codeEditor = (
    <Editor
      height="100%"
      path={filePath ?? undefined}
      language={language}
      value={activeFileTab?.content ?? content ?? ''}
      theme={monacoTheme}
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
  );

  return (
    <div
      className={cn(
        'flex h-full flex-col transition-opacity duration-200 ease-out motion-reduce:transition-none motion-reduce:duration-0',
      )}>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {!isMarkdownDoc ? (
          codeEditor
        ) : (
          <ResizablePanelGroup
            className="h-full min-h-0 w-full"
            defaultLayout={markdownPanelsDefaultLayout}
            disabled={markdownPreviewMode !== 'split'}
            groupRef={markdownLayoutGroupRef}
            id="code-editor-markdown-split"
            orientation="horizontal">
            <ResizablePanel
              className="flex min-h-0 min-w-0 flex-col overflow-hidden"
              id={MARKDOWN_EDITOR_PANEL_ID}
              minSize={markdownPreviewMode === 'split' ? '25%' : 0}>
              <div
                className={cn(
                  'relative min-h-0 min-w-0 flex-1 transition-opacity duration-200 ease-out motion-reduce:transition-none motion-reduce:duration-0',
                  markdownPreviewMode === 'preview' && 'hidden',
                )}>
                {codeEditor}
              </div>
            </ResizablePanel>
            <ResizableHandle
              className="aria-[orientation=vertical]:before:right-0! aria-[orientation=vertical]:before:left-auto!"
              disabled={markdownPreviewMode !== 'split'}
            />
            <ResizablePanel
              className={cn(
                'bg-surface flex min-h-0 min-w-0 flex-col overflow-hidden transition-opacity duration-200 ease-out motion-reduce:transition-none motion-reduce:duration-0',
                markdownPreviewMode === 'split' && 'border-border border-l',
              )}
              id={MARKDOWN_PREVIEW_PANEL_ID}
              minSize={markdownPreviewMode === 'split' ? '280px' : 0}>
              {markdownPreviewMode !== 'edit' ? (
                markdownPreviewMode === 'split' ? (
                  <DebouncedMarkdownPreview markdown={liveMarkdownSource} debounceMs={200} />
                ) : (
                  <MarkdownPreview markdown={liveMarkdownSource} />
                )
              ) : null}
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>
    </div>
  );
}
