import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import MonacoEditor, { type OnMount } from '@monaco-editor/react';
import type { PanelImperativeHandle, PanelSize } from 'react-resizable-panels';
import { X, Code2, BookOpen, Maximize2, Minimize2, ExternalLink } from 'lucide-react';
import {
  useScriptPanelStore,
  type ActiveScript,
} from '../../../modules/code-editor/ScriptPanelStore';
import type { ScriptCode } from '../../../modules/code-editor/CodeEditorTypes';
import { useEditorPanelsStore } from '../../../store/useEditorPanelsStore';
import { useWorkflowStore } from '../../../store/useWorkflowStore';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  usePanelRef,
} from '../../../ui/Resizable.js';
import {
  encodeToBase64,
  decodeFromBase64,
} from '../../../modules/code-editor/editor/Base64Handler';
import { CsxSnippetToolbar } from '../../../modules/code-editor/editor/CsxSnippetToolbar';
import { CsxReferencePanel } from '../../../modules/code-editor/editor/CsxReferencePanel';
import { applyDiagnostics } from '../../../modules/code-editor/editor/CsxDiagnostics';
import { setupMonacoWithLsp } from '../../../modules/code-editor/editor/MonacoSetup';
import { applyScriptValueToWorkflow } from '../../../modules/code-editor/ScriptWorkflowSync';
import { getScriptLocationError } from '../../../modules/code-editor/ScriptLocationValidation';
import { subscribeMonacoModelMarkers } from '../../../editor/monacoMarkerSync';
import { useResolvedColorTheme } from '../../../hooks/useResolvedColorTheme.js';
import { useEditorValidationStore } from '../../../store/useEditorValidationStore';
import { Input } from '../../../ui/Input';
import type { CsharpLspClient } from '../../../modules/code-editor/editor/lspClient';

const MIN_HEIGHT = 200;
const MAX_HEIGHT = 800;

/** Inline script editing for task editor without workflow store. */
export type ScriptEditorTaskInlineProps = {
  value: ScriptCode;
  onChange: (next: ScriptCode) => void;
  label?: string;
  /** Web shell: open in full Monaco editor tab */
  onOpenInFullEditor?: () => void;
  /** Task editor inline: return to script picker without saving */
  onPickAnotherScript?: () => void;
};

export type ScriptEditorPanelProps = {
  taskInline?: ScriptEditorTaskInlineProps;
  /**
   * Flow editor: absolute workflow directory (`…/Workflows/{group}`) used to resolve
   * `value.location` into a full path for "Open in full editor".
   */
  workflowDirectoryPath?: string;
  /** Host: open the current script path in the full code editor tab (workflow panel). */
  onOpenScriptFileInHost?: (absolutePath: string) => void;
};

const FLOW_EDITOR_MAIN_COLUMN_ID = 'flow-editor-vertical-main';
const FLOW_EDITOR_SCRIPT_COLUMN_ID = 'flow-editor-vertical-script';

const ScriptPanelResizeContext = createContext<RefObject<PanelImperativeHandle | null> | null>(
  null,
);

function useScriptPanelResizePanelRef() {
  return useContext(ScriptPanelResizeContext);
}

/**
 * Flow editor: canvas (top) + script panel (bottom); script height persisted in store.
 */
export function FlowEditorCanvasAndScriptResizableColumn({
  canvas,
  scriptPanel,
}: {
  canvas: ReactNode;
  scriptPanel: ReactNode | null;
}) {
  const setScriptPanelHeight = useEditorPanelsStore((s) => s.setScriptPanelHeight);
  const scriptPanelPanelRef = usePanelRef();
  const hasScript = scriptPanel != null;

  const defaultLayout = useMemo(() => {
    const scriptPx = Math.min(
      MAX_HEIGHT,
      Math.max(MIN_HEIGHT, useEditorPanelsStore.getState().scriptPanelHeight),
    );
    const groupH =
      typeof window !== 'undefined'
        ? Math.max(320, Math.min(window.innerHeight - 80, window.innerHeight * 0.92))
        : 640;
    const scriptPct = (100 * scriptPx) / groupH;
    const mainPct = 100 - scriptPct;
    const r = (n: number) => Math.round(n * 1000) / 1000;
    return {
      [FLOW_EDITOR_MAIN_COLUMN_ID]: r(mainPct),
      [FLOW_EDITOR_SCRIPT_COLUMN_ID]: r(scriptPct),
    } as const;
  }, []);

  return (
    <ResizablePanelGroup
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      defaultLayout={defaultLayout}
      id="flow-editor-vertical-resize"
      orientation="vertical">
      <ResizablePanel
        className="flex min-h-0 min-w-0 flex-col overflow-hidden"
        id={FLOW_EDITOR_MAIN_COLUMN_ID}
        minSize={hasScript ? '20%' : '100%'}>
        {canvas}
      </ResizablePanel>
      {hasScript && (
        <>
          <ResizableHandle className="aria-[orientation=horizontal]:before:top-auto! aria-[orientation=horizontal]:before:bottom-0!" />
          <ResizablePanel
            className="border-border bg-surface relative z-40 flex min-h-0 flex-col overflow-hidden"
            id={FLOW_EDITOR_SCRIPT_COLUMN_ID}
            maxSize={MAX_HEIGHT}
            minSize={MIN_HEIGHT}
            panelRef={scriptPanelPanelRef}
            onResize={(size) => {
              setScriptPanelHeight(Math.round(size.inPixels));
            }}>
            <ScriptPanelResizeContext.Provider value={scriptPanelPanelRef}>
              {scriptPanel}
            </ScriptPanelResizeContext.Provider>
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}

function resolveWorkflowScriptAbsolutePath(workflowDir: string, location: string): string {
  const trimmed = location.trim();
  const relativePath = trimmed.startsWith('./') ? trimmed.slice(2) : trimmed;
  const root = workflowDir
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/')
    .replace(/\/+$/, '');
  return `${root}/${relativePath}`.replace(/\/{2,}/g, '/');
}

export function ScriptEditorPanel({
  taskInline,
  workflowDirectoryPath,
  onOpenScriptFileInHost,
}: ScriptEditorPanelProps = {}) {
  const resolvedColorTheme = useResolvedColorTheme();
  const monacoTheme = resolvedColorTheme === 'dark' ? 'vs-dark' : 'vs';

  const { activeScript: storeActive, updateScriptValue, closeScript } = useScriptPanelStore();
  const { setScriptPanelOpen } = useEditorPanelsStore();
  const { updateWorkflow } = useWorkflowStore();

  const activeScript: ActiveScript | null = useMemo(() => {
    if (taskInline) {
      return {
        stateKey: '__task-inline__',
        listField: 'onEntries',
        index: 0,
        scriptField: 'mapping',
        value: taskInline.value,
        templateType: 'mapping',
        label: taskInline.label ?? 'C# Script',
        taskType: 'ScriptTask',
      };
    }
    return storeActive;
  }, [
    taskInline,
    taskInline?.value.code,
    taskInline?.value.location,
    taskInline?.value.encoding,
    taskInline?.label,
    storeActive,
  ]);
  const [showReference, setShowReference] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const scriptLayoutPanelRef = useScriptPanelResizePanelRef();
  const sizeBeforeMaximizeRef = useRef<PanelSize | null>(null);
  const [locationDraft, setLocationDraft] = useState('');
  const [locationError, setLocationError] = useState<string | null>(null);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const diagnosticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markerDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const lspClientRef = useRef<CsharpLspClient | null>(null);
  const lspSessionId = useRef(crypto.randomUUID());
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const layoutObserverRef = useRef<ResizeObserver | null>(null);
  const layoutRafRef = useRef(0);

  const decoded = useMemo(() => {
    if (!activeScript?.value?.code) return '';
    return decodeFromBase64(activeScript.value.code);
  }, [activeScript?.value?.code]);

  const scriptValidationKey = activeScript
    ? `csx:${activeScript.stateKey}:${activeScript.templateType}`
    : '';
  const scriptMarkerCounts = useEditorValidationStore((s) =>
    scriptValidationKey && s.activeFilePath === scriptValidationKey ? s.markerCounts : null,
  );

  useEffect(() => {
    const nextLocation = activeScript?.value.location ?? '';
    setLocationDraft(nextLocation);
    setLocationError(getScriptLocationError(nextLocation));
  }, [activeScript, activeScript?.value.location]);

  // Sync changes back to workflow store
  const syncToWorkflow = useCallback(
    (newCode: string) => {
      if (!activeScript) return;
      const encodedCode = encodeToBase64(newCode);
      const newValue = { ...activeScript.value, code: encodedCode, encoding: 'B64' as const };

      if (taskInline) {
        taskInline.onChange(newValue);
        return;
      }
      updateScriptValue(newValue);
      updateWorkflow((draft: any) => applyScriptValueToWorkflow(draft, activeScript, newValue));
    },
    [activeScript, taskInline, updateScriptValue, updateWorkflow],
  );

  const handleCodeChange = useCallback(
    (newCode: string | undefined) => {
      if (!activeScript) return;
      const next = newCode || '';
      // Filter Monaco's first-render EOL normalization echo (CRLF → LF).
      // If the only difference is line endings, treat as no user edit and
      // avoid emitting onChange — otherwise upstream "is dirty" trackers
      // would falsely fire on a freshly loaded script.
      if (next.replace(/\r\n/g, '\n') === decoded.replace(/\r\n/g, '\n')) return;
      syncToWorkflow(next);

      if (diagnosticTimerRef.current) clearTimeout(diagnosticTimerRef.current);
      diagnosticTimerRef.current = setTimeout(() => {
        const editor = editorRef.current;
        const monaco = monacoRef.current;
        if (editor && monaco) {
          applyDiagnostics(monaco, editor.getModel(), next, activeScript.templateType);
        }
      }, 300);
    },
    [activeScript, decoded, syncToWorkflow],
  );

  const handleEditorMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      const code = editor.getValue();
      if (code && activeScript) {
        applyDiagnostics(monaco, editor.getModel(), code, activeScript.templateType);
      }

      if (!taskInline) {
        editor.focus();
      }

      if (activeScript) {
        const key = `csx:${activeScript.stateKey}:${activeScript.templateType}`;
        markerDisposableRef.current?.dispose();
        markerDisposableRef.current = subscribeMonacoModelMarkers(editor, monaco, key);
      }

      // Start Roslyn LSP client (static completions registered as fallback inside)
      setupMonacoWithLsp(monaco, lspSessionId.current, {
        disableLsp: Boolean(taskInline),
      }).then((client) => {
        lspClientRef.current = client;
      });

      // Manual layout: `automaticLayout: false` + integer pixel size avoids subpixel
      // drift in nested flex/overflow (VS Code webview) that stacks view-lines on scroll.
      layoutObserverRef.current?.disconnect();
      layoutObserverRef.current = null;
      cancelAnimationFrame(layoutRafRef.current);
      const container = editorContainerRef.current;
      if (container) {
        const runLayout = () => {
          cancelAnimationFrame(layoutRafRef.current);
          layoutRafRef.current = requestAnimationFrame(() => {
            const rect = container.getBoundingClientRect();
            const w = Math.max(0, Math.floor(rect.width));
            const h = Math.max(0, Math.floor(rect.height));
            editor.layout({ width: w, height: h });
          });
        };
        const ro = new ResizeObserver(runLayout);
        ro.observe(container);
        layoutObserverRef.current = ro;
        runLayout();
      }
    },
    [activeScript, taskInline],
  );

  useEffect(() => {
    if (!scriptValidationKey) {
      markerDisposableRef.current?.dispose();
      markerDisposableRef.current = null;
      return;
    }
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    markerDisposableRef.current?.dispose();
    markerDisposableRef.current = subscribeMonacoModelMarkers(editor, monaco, scriptValidationKey);
    return () => {
      markerDisposableRef.current?.dispose();
      markerDisposableRef.current = null;
    };
  }, [scriptValidationKey]);

  const handleReferenceInsert = useCallback((text: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    requestAnimationFrame(() => {
      editor.trigger('reference', 'editor.action.insertSnippet', { snippet: text });
    });
  }, []);

  const handleClose = useCallback(() => {
    if (taskInline) return;
    closeScript();
    setScriptPanelOpen(false);
  }, [closeScript, setScriptPanelOpen, taskInline]);

  const handleOpenWorkflowScriptInFullEditor = useCallback(() => {
    if (!onOpenScriptFileInHost || !workflowDirectoryPath) return;
    const loc = locationDraft.trim();
    if (!loc || getScriptLocationError(loc)) return;
    onOpenScriptFileInHost(resolveWorkflowScriptAbsolutePath(workflowDirectoryPath, loc));
  }, [locationDraft, onOpenScriptFileInHost, workflowDirectoryPath]);

  const handleLocationChange = useCallback(
    (loc: string) => {
      setLocationDraft(loc);
      const nextError = getScriptLocationError(loc);
      setLocationError(nextError);

      if (!activeScript || nextError) return;

      const newValue = { ...activeScript.value, location: loc };
      if (taskInline) {
        taskInline.onChange(newValue);
        return;
      }
      updateScriptValue(newValue);
      updateWorkflow((draft: any) => applyScriptValueToWorkflow(draft, activeScript, newValue));
    },
    [activeScript, taskInline, updateScriptValue, updateWorkflow],
  );

  const toggleMaximize = useCallback(() => {
    const api = scriptLayoutPanelRef?.current;
    if (!api) {
      setIsMaximized((m) => !m);
      return;
    }
    if (!isMaximized) {
      sizeBeforeMaximizeRef.current = api.getSize();
      api.resize('70%');
      setIsMaximized(true);
    } else {
      const prev = sizeBeforeMaximizeRef.current;
      if (prev) {
        api.resize(`${prev.asPercentage}%`);
      } else {
        api.resize(useEditorPanelsStore.getState().scriptPanelHeight);
      }
      setIsMaximized(false);
    }
  }, [isMaximized, scriptLayoutPanelRef]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (diagnosticTimerRef.current) clearTimeout(diagnosticTimerRef.current);
      markerDisposableRef.current?.dispose();
      markerDisposableRef.current = null;
      lspClientRef.current?.dispose();
      lspClientRef.current = null;
      layoutObserverRef.current?.disconnect();
      layoutObserverRef.current = null;
      cancelAnimationFrame(layoutRafRef.current);
    };
  }, []);

  if (!activeScript) return null;

  return (
    <div className="bg-surface flex h-full min-h-0 flex-col">
      {/* Header bar */}
      <div className="border-border-subtle bg-muted/70 flex shrink-0 items-start gap-2 border-b px-3 py-1">
        <div className="bg-secondary-muted mt-px flex size-4 shrink-0 items-center justify-center rounded-md">
          <Code2 size={11} className="text-secondary-icon" />
        </div>
        <span className="text-foreground mt-px truncate text-[11px] font-semibold">
          {activeScript.label}
        </span>
        {!taskInline ? (
          <span className="text-muted-foreground mt-px truncate font-mono text-[10px]">
            {activeScript.stateKey}
          </span>
        ) : null}

        <div className="min-w-2 flex-1" />

        {/* Location — short error under input (no full-width alert) */}
        <div className="max-w-[min(280px,40vw)] min-w-0 flex-1 shrink-0">
          <Input
            value={locationDraft}
            onChange={(e) => handleLocationChange(e.target.value)}
            placeholder="./ScriptName.csx"
            aria-invalid={locationError ? 'true' : 'false'}
            aria-describedby={locationError ? 'script-editor-location-hint' : undefined}
            size="sm"
            className="w-full"
            inputClassName="font-mono text-[11px]"
          />
          {locationError ? (
            <p
              id="script-editor-location-hint"
              role="alert"
              className="text-destructive/80 dark:text-destructive/70 mt-1 max-w-full pl-0.5 text-[10px] leading-snug">
              {locationError}
            </p>
          ) : null}
        </div>

        <div className="flex max-w-full shrink-0 flex-wrap items-center justify-end gap-1 pt-0.5">
          {taskInline?.onPickAnotherScript ? (
            <button
              type="button"
              onClick={taskInline.onPickAnotherScript}
              className="text-secondary-text hover:bg-secondary-muted shrink-0 rounded-md px-2 py-1 text-[10px] font-medium transition-colors"
              title="Discard changes and pick another script file">
              Choose different script
            </button>
          ) : null}
          {taskInline?.onOpenInFullEditor ? (
            <button
              type="button"
              onClick={taskInline.onOpenInFullEditor}
              className="text-secondary-text hover:bg-secondary-muted flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors"
              title="Open the .csx file in the full editor (new tab)">
              <ExternalLink size={12} className="opacity-80" />
              <span>Open in full editor</span>
            </button>
          ) : null}
          {!taskInline && onOpenScriptFileInHost && workflowDirectoryPath ? (
            <button
              type="button"
              onClick={handleOpenWorkflowScriptInFullEditor}
              disabled={!locationDraft.trim() || Boolean(getScriptLocationError(locationDraft))}
              className="text-secondary-text hover:bg-secondary-muted flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-40"
              title="Open the .csx file in the full editor (new tab)">
              <ExternalLink size={12} className="opacity-80" />
              <span>Open in full editor</span>
            </button>
          ) : null}
          {/* API Reference toggle */}
          <button
            type="button"
            onClick={() => setShowReference(!showReference)}
            className={`rounded-lg p-1.5 transition-all ${
              showReference
                ? 'bg-secondary-surface text-secondary-text'
                : 'text-muted-foreground hover:bg-muted hover:text-secondary-text'
            }`}
            title="API Reference">
            <BookOpen size={14} />
          </button>

          {!taskInline && (
            <>
              <button
                type="button"
                onClick={toggleMaximize}
                className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-1.5 transition-all"
                title={isMaximized ? 'Restore' : 'Maximize'}>
                {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-1.5 transition-all"
                title="Close">
                <X size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Snippet toolbar — horizontal, above editor */}
      <div className="border-border-subtle bg-muted/40 shrink-0 border-b">
        <CsxSnippetToolbar templateType={activeScript.templateType} editorRef={editorRef} />
      </div>

      {/* Editor area */}
      <div className="flex min-h-0 flex-1">
        {/* Monaco editor (full width) */}
        <div ref={editorContainerRef} className="min-h-0 min-w-0 flex-1">
          <MonacoEditor
            height="100%"
            language="csharp"
            value={decoded}
            onChange={handleCodeChange}
            onMount={handleEditorMount}
            theme={monacoTheme}
            options={{
              minimap: { enabled: true, maxColumn: 80 },
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              fontSize: 13,
              tabSize: 4,
              wordWrap: 'on',
              wrappingStrategy: 'advanced',
              folding: true,
              glyphMargin: true,
              lineDecorationsWidth: 8,
              lineNumbersMinChars: 3,
              renderLineHighlight: 'line',
              overviewRulerLanes: 2,
              scrollbar: {
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
                alwaysConsumeMouseWheel: true,
              },
              automaticLayout: false,
              fixedOverflowWidgets: true,
              padding: { top: 8, bottom: 8 },
              bracketPairColorization: { enabled: true },
              guides: { bracketPairs: true, indentation: true },
              suggestOnTriggerCharacters: true,
              // VS Code webview iframe keyboard dispatch interferes with the
              // EditContext API (Monaco >= 0.53 default). Fall back to the
              // legacy hidden-textarea input so Space and other keys reach
              // the editor reliably. See monaco-editor#5059.
              editContext: false,
            }}
          />
        </div>

        {/* Right — API Reference panel */}
        {showReference && (
          <div className="border-border-subtle w-64 shrink-0 overflow-y-auto border-l">
            <CsxReferencePanel
              onClose={() => setShowReference(false)}
              onInsert={handleReferenceInsert}
            />
          </div>
        )}
      </div>

      {/* Bottom status bar */}
      <div className="border-border-subtle bg-muted/40 flex shrink-0 items-center justify-between border-t px-3 py-1">
        <span className="text-muted-foreground font-mono text-[10px]">
          {decoded.split('\n').length} lines &middot; {activeScript.templateType}
          {scriptMarkerCounts &&
            (scriptMarkerCounts.errors > 0 || scriptMarkerCounts.warnings > 0) && (
              <>
                {' '}
                &middot;{' '}
                {scriptMarkerCounts.errors > 0 && (
                  <span className="text-destructive">{scriptMarkerCounts.errors} err</span>
                )}
                {scriptMarkerCounts.errors > 0 && scriptMarkerCounts.warnings > 0 && ' '}
                {scriptMarkerCounts.warnings > 0 && (
                  <span className="text-amber-600 dark:text-amber-500">
                    {scriptMarkerCounts.warnings} warn
                  </span>
                )}
              </>
            )}
        </span>
        <span className="text-muted-foreground font-mono text-[10px]">
          C# Script &middot; UTF-8
        </span>
      </div>
    </div>
  );
}
