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
import { X, Code2, BookOpen, Maximize2, Minimize2 } from 'lucide-react';
import { useScriptPanelStore } from '../../../modules/code-editor/ScriptPanelStore';
import { useEditorPanelsStore } from '../../../store/useEditorPanelsStore';
import { useWorkflowStore } from '../../../store/useWorkflowStore';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  usePanelRef,
} from '../../../ui/Resizable.js';
import { encodeToBase64, decodeFromBase64 } from '../../../modules/code-editor/editor/Base64Handler';
import { CsxSnippetToolbar } from '../../../modules/code-editor/editor/CsxSnippetToolbar';
import { CsxReferencePanel } from '../../../modules/code-editor/editor/CsxReferencePanel';
import { applyDiagnostics } from '../../../modules/code-editor/editor/CsxDiagnostics';
import { setupMonacoWithLsp } from '../../../modules/code-editor/editor/MonacoSetup';
import { applyScriptValueToWorkflow } from '../../../modules/code-editor/ScriptWorkflowSync';
import { getScriptLocationError } from '../../../modules/code-editor/ScriptLocationValidation';
import { subscribeMonacoModelMarkers } from '../../../editor/monacoMarkerSync';
import { useEditorValidationStore } from '../../../store/useEditorValidationStore';
import { Alert, AlertDescription } from '../../../ui/Alert';
import { Input } from '../../../ui/Input';
import type { CsharpLspClient } from '../../../modules/code-editor/editor/lspClient';

const MIN_HEIGHT = 200;
const MAX_HEIGHT = 700;

const FLOW_EDITOR_MAIN_COLUMN_ID = 'flow-editor-vertical-main';
const FLOW_EDITOR_SCRIPT_COLUMN_ID = 'flow-editor-vertical-script';

const ScriptPanelResizeContext = createContext<RefObject<PanelImperativeHandle | null> | null>(
  null,
);

function useScriptPanelResizePanelRef() {
  return useContext(ScriptPanelResizeContext);
}

/**
 * Flow editöründe canvas (üst) + script paneli (alt) dikey bölünür; script yüksekliği store’da tutulur.
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

  if (!scriptPanel) {
    return <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{canvas}</div>;
  }

  return (
    <ResizablePanelGroup
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      defaultLayout={defaultLayout}
      id="flow-editor-vertical-resize"
      orientation="vertical">
      <ResizablePanel
        className="flex min-h-0 min-w-0 flex-col overflow-hidden"
        id={FLOW_EDITOR_MAIN_COLUMN_ID}
        minSize="20%">
        {canvas}
      </ResizablePanel>
      <ResizableHandle className="aria-[orientation=horizontal]:before:top-auto aria-[orientation=horizontal]:before:bottom-0" />
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
    </ResizablePanelGroup>
  );
}

export function ScriptEditorPanel() {
  const { activeScript, updateScriptValue, closeScript } = useScriptPanelStore();
  const { setScriptPanelOpen } = useEditorPanelsStore();
  const { updateWorkflow } = useWorkflowStore();
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

      updateScriptValue(newValue);
      updateWorkflow((draft: any) => applyScriptValueToWorkflow(draft, activeScript, newValue));
    },
    [activeScript, updateScriptValue, updateWorkflow],
  );

  const handleCodeChange = useCallback(
    (newCode: string | undefined) => {
      if (!activeScript) return;
      if ((newCode || '') === decoded) return;
      syncToWorkflow(newCode || '');

      if (diagnosticTimerRef.current) clearTimeout(diagnosticTimerRef.current);
      diagnosticTimerRef.current = setTimeout(() => {
        const editor = editorRef.current;
        const monaco = monacoRef.current;
        if (editor && monaco) {
          applyDiagnostics(monaco, editor.getModel(), newCode || '', activeScript.templateType);
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

      editor.focus();

      if (activeScript) {
        const key = `csx:${activeScript.stateKey}:${activeScript.templateType}`;
        markerDisposableRef.current?.dispose();
        markerDisposableRef.current = subscribeMonacoModelMarkers(editor, monaco, key);
      }

      // Start Roslyn LSP client (static completions registered as fallback inside)
      setupMonacoWithLsp(monaco, lspSessionId.current).then((client) => {
        lspClientRef.current = client;
      });
    },
    [activeScript],
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
    closeScript();
    setScriptPanelOpen(false);
  }, [closeScript, setScriptPanelOpen]);

  const handleLocationChange = useCallback(
    (loc: string) => {
      setLocationDraft(loc);
      const nextError = getScriptLocationError(loc);
      setLocationError(nextError);

      if (!activeScript || nextError) return;

      const newValue = { ...activeScript.value, location: loc };
      updateScriptValue(newValue);
      updateWorkflow((draft: any) => applyScriptValueToWorkflow(draft, activeScript, newValue));
    },
    [activeScript, updateScriptValue, updateWorkflow],
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
    };
  }, []);

  if (!activeScript) return null;

  return (
    <div className="bg-surface flex h-full min-h-0 flex-col">
      {/* Header bar */}
      <div className="border-border-subtle bg-muted/70 flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
        <div className="bg-secondary-muted flex size-5 shrink-0 items-center justify-center rounded-md">
          <Code2 size={12} className="text-secondary-icon" />
        </div>
        <span className="text-foreground truncate text-[11px] font-semibold">
          {activeScript.label}
        </span>
        <span className="text-muted-foreground truncate font-mono text-[10px]">
          {activeScript.stateKey}
        </span>

        <div className="flex-1" />

        {/* Location input */}
        <Input
          value={locationDraft}
          onChange={(e) => handleLocationChange(e.target.value)}
          placeholder="./ScriptName.csx"
          aria-invalid={locationError ? 'true' : 'false'}
          size="sm"
          className="w-52"
          inputClassName="font-mono text-[11px]"
        />

        {/* API Reference toggle */}
        <button
          onClick={() => setShowReference(!showReference)}
          className={`rounded-lg p-1.5 transition-all ${
            showReference
              ? 'bg-secondary-surface text-secondary-text'
              : 'text-muted-foreground hover:bg-muted hover:text-secondary-text'
          }`}
          title="API Reference">
          <BookOpen size={14} />
        </button>

        {/* Maximize/Restore */}
        <button
          onClick={toggleMaximize}
          className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-1.5 transition-all"
          title={isMaximized ? 'Restore' : 'Maximize'}>
          {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>

        {/* Close */}
        <button
          onClick={handleClose}
          className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-1.5 transition-all"
          title="Close">
          <X size={14} />
        </button>
      </div>

      {/* Snippet toolbar — horizontal, above editor */}
      {locationError && (
        <div className="shrink-0 px-3 pt-2">
          <Alert variant="destructive" className="px-3 py-2 text-xs">
            <AlertDescription>{locationError}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="border-border-subtle bg-muted/40 shrink-0 border-b">
        <CsxSnippetToolbar templateType={activeScript.templateType} editorRef={editorRef} />
      </div>

      {/* Editor area */}
      <div className="flex min-h-0 flex-1">
        {/* Monaco editor (full width) */}
        <div className="min-h-0 min-w-0 flex-1">
          <MonacoEditor
            height="100%"
            language="csharp"
            value={decoded}
            onChange={handleCodeChange}
            onMount={handleEditorMount}
            theme="vs"
            options={{
              minimap: { enabled: true, maxColumn: 80 },
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              fontSize: 13,
              tabSize: 4,
              wordWrap: 'on',
              folding: true,
              glyphMargin: true,
              lineDecorationsWidth: 8,
              lineNumbersMinChars: 3,
              renderLineHighlight: 'line',
              overviewRulerLanes: 2,
              scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
              automaticLayout: true,
              padding: { top: 8, bottom: 8 },
              bracketPairColorization: { enabled: true },
              guides: { bracketPairs: true, indentation: true },
              suggestOnTriggerCharacters: true,
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
