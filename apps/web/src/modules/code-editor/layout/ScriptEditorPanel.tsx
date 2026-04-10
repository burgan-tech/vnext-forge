import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MonacoEditor, { type OnMount } from '@monaco-editor/react';
import { X, Code2, BookOpen, Maximize2, Minimize2 } from 'lucide-react';
import { useScriptPanelStore } from '@modules/code-editor/ScriptPanelStore';
import { useUIStore } from '@app/store/UiStore';
import { useWorkflowStore } from '@app/store/WorkflowStore';
import { encodeToBase64, decodeFromBase64 } from '@modules/code-editor/editor/Base64Handler';
import { CsxSnippetToolbar } from '@modules/code-editor/editor/CsxSnippetToolbar';
import { CsxReferencePanel } from '@modules/code-editor/editor/CsxReferencePanel';
import { applyDiagnostics } from '@modules/code-editor/editor/CsxDiagnostics';
import { applyScriptValueToWorkflow } from '@modules/code-editor/ScriptWorkflowSync';
import { getScriptLocationError } from '@modules/code-editor/ScriptLocationValidation';
import { Alert, AlertDescription } from '@shared/ui/Alert';
import { Input } from '@shared/ui/Input';

const MIN_HEIGHT = 200;
const MAX_HEIGHT = 700;

export function ScriptEditorPanel() {
  const { activeScript, updateScriptValue, closeScript } = useScriptPanelStore();
  const { scriptPanelHeight, setScriptPanelHeight, setScriptPanelOpen } = useUIStore();
  const { updateWorkflow } = useWorkflowStore();
  const [showReference, setShowReference] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [locationDraft, setLocationDraft] = useState('');
  const [locationError, setLocationError] = useState<string | null>(null);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const diagnosticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resizingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  const decoded = useMemo(() => {
    if (!activeScript?.value?.code) return '';
    return decodeFromBase64(activeScript.value.code);
  }, [activeScript?.value?.code]);

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
    [activeScript, syncToWorkflow],
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
    },
    [activeScript],
  );

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

  // ─── Resize handle ───
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizingRef.current = true;
      startYRef.current = e.clientY;
      startHeightRef.current = isMaximized ? window.innerHeight * 0.7 : scriptPanelHeight;

      const onMouseMove = (ev: MouseEvent) => {
        if (!resizingRef.current) return;
        const delta = startYRef.current - ev.clientY;
        const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeightRef.current + delta));
        setScriptPanelHeight(newHeight);
        if (isMaximized) setIsMaximized(false);
      };

      const onMouseUp = () => {
        resizingRef.current = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [scriptPanelHeight, setScriptPanelHeight, isMaximized],
  );

  // Cleanup
  useEffect(() => {
    return () => {
      if (diagnosticTimerRef.current) clearTimeout(diagnosticTimerRef.current);
    };
  }, []);

  if (!activeScript) return null;

  const panelHeight = isMaximized ? '70vh' : scriptPanelHeight;
  // Header(~37) + snippet bar(~32) + status bar(~24) + resize(3) = ~96
  const editorHeight = typeof panelHeight === 'number' ? panelHeight - 96 : 'calc(70vh - 96px)';

  return (
    <div
      className="flex shrink-0 flex-col border-t border-border bg-surface"
      style={{ height: panelHeight }}
    >
      {/* Resize handle */}
      <div
        className="group relative h-[3px] shrink-0 cursor-row-resize bg-transparent transition-colors hover:bg-secondary-border"
        onMouseDown={handleResizeStart}
      >
        <div className="absolute inset-x-0 -top-1 -bottom-1" />
      </div>

      {/* Header bar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border-subtle bg-muted/70 px-3 py-1.5">
        <div className="flex size-5 shrink-0 items-center justify-center rounded-md bg-secondary-muted">
          <Code2 size={12} className="text-secondary-icon" />
        </div>
        <span className="truncate text-[11px] font-semibold text-foreground">
          {activeScript.label}
        </span>
        <span className="truncate font-mono text-[10px] text-muted-foreground">
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
          className={`p-1.5 rounded-lg transition-all ${
            showReference
              ? 'bg-secondary-surface text-secondary-text'
              : 'text-muted-foreground hover:bg-muted hover:text-secondary-text'
          }`}
          title="API Reference"
        >
          <BookOpen size={14} />
        </button>

        {/* Maximize/Restore */}
        <button
          onClick={() => setIsMaximized(!isMaximized)}
          className="rounded-lg p-1.5 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>

        {/* Close */}
        <button
          onClick={handleClose}
          className="rounded-lg p-1.5 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>

      {/* Snippet toolbar — horizontal, above editor */}
      {locationError && (
        <div className="px-3 pt-2 shrink-0">
          <Alert variant="destructive" className="px-3 py-2 text-xs">
            <AlertDescription>{locationError}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="shrink-0 border-b border-border-subtle bg-muted/40">
        <CsxSnippetToolbar templateType={activeScript.templateType} editorRef={editorRef} />
      </div>

      {/* Editor area */}
      <div className="flex flex-1 min-h-0">
        {/* Monaco editor (full width) */}
        <div className="flex-1 min-w-0">
          <MonacoEditor
            height={editorHeight}
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
          <div className="w-64 shrink-0 overflow-y-auto border-l border-border-subtle">
            <CsxReferencePanel
              onClose={() => setShowReference(false)}
              onInsert={handleReferenceInsert}
            />
          </div>
        )}
      </div>

      {/* Bottom status bar */}
      <div className="flex shrink-0 items-center justify-between border-t border-border-subtle bg-muted/40 px-3 py-1">
        <span className="font-mono text-[10px] text-muted-foreground">
          {decoded.split('\n').length} lines &middot; {activeScript.templateType}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          C# Script &middot; UTF-8
        </span>
      </div>
    </div>
  );
}
