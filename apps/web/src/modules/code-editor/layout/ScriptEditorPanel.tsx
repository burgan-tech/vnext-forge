import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MonacoEditor, { type OnMount } from '@monaco-editor/react';
import { X, Code2, BookOpen, Maximize2, Minimize2 } from 'lucide-react';
import { useScriptPanelStore } from '@modules/code-editor/ScriptPanelStore';
import { useUIStore } from '@app/store/UiStore';
import { useWorkflowStore } from '@modules/canvas-interaction/WorkflowStore';
import { encodeToBase64, decodeFromBase64 } from '@modules/code-editor/editor/Base64Handler';
import { CsxSnippetToolbar } from '@modules/code-editor/editor/CsxSnippetToolbar';
import { CsxReferencePanel } from '@modules/code-editor/editor/CsxReferencePanel';
import { applyDiagnostics } from '@modules/code-editor/editor/CsxDiagnostics';

const MIN_HEIGHT = 200;
const MAX_HEIGHT = 700;

export function ScriptEditorPanel() {
  const { activeScript, updateScriptValue, closeScript } = useScriptPanelStore();
  const { scriptPanelHeight, setScriptPanelHeight, setScriptPanelOpen } = useUIStore();
  const { updateWorkflow } = useWorkflowStore();
  const [showReference, setShowReference] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
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

  // Sync changes back to workflow store
  const syncToWorkflow = useCallback(
    (newCode: string) => {
      if (!activeScript) return;
      const encodedCode = encodeToBase64(newCode);
      const newValue = { ...activeScript.value, code: encodedCode, encoding: 'B64' as const };

      updateScriptValue(newValue);

      updateWorkflow((draft: any) => {
        const state = draft.attributes?.states?.find((s: any) => s.key === activeScript.stateKey);
        if (!state) return;

        if (activeScript.listField === 'transitions') {
          const transition = state.transitions?.[activeScript.index];
          if (transition) {
            transition[activeScript.scriptField] = newValue;
            if (activeScript.scriptField === 'rule') transition.condition = newValue;
            else if (activeScript.scriptField === 'condition') transition.rule = newValue;
          }
        } else {
          const entry = state[activeScript.listField]?.[activeScript.index];
          if (entry) {
            entry[activeScript.scriptField] = newValue;
          }
        }
      });
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
      if (!activeScript) return;
      const newValue = { ...activeScript.value, location: loc };
      updateScriptValue(newValue);

      updateWorkflow((draft: any) => {
        const state = draft.attributes?.states?.find((s: any) => s.key === activeScript.stateKey);
        if (!state) return;

        if (activeScript.listField === 'transitions') {
          const transition = state.transitions?.[activeScript.index];
          if (transition) {
            transition[activeScript.scriptField] = newValue;
            if (activeScript.scriptField === 'rule') transition.condition = newValue;
            else if (activeScript.scriptField === 'condition') transition.rule = newValue;
          }
        } else {
          const entry = state[activeScript.listField]?.[activeScript.index];
          if (entry) entry[activeScript.scriptField] = newValue;
        }
      });
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
      className="border-t border-slate-200/60 bg-white flex flex-col shrink-0"
      style={{ height: panelHeight }}
    >
      {/* Resize handle */}
      <div
        className="h-[3px] bg-transparent hover:bg-indigo-500/30 cursor-row-resize transition-colors shrink-0 group relative"
        onMouseDown={handleResizeStart}
      >
        <div className="absolute inset-x-0 -top-1 -bottom-1" />
      </div>

      {/* Header bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-100 bg-slate-50/50 shrink-0">
        <div className="size-5 rounded-md bg-indigo-500/10 flex items-center justify-center shrink-0">
          <Code2 size={12} className="text-indigo-500" />
        </div>
        <span className="text-[11px] font-semibold text-slate-600 truncate">
          {activeScript.label}
        </span>
        <span className="text-[10px] text-slate-400 font-mono truncate">
          {activeScript.stateKey}
        </span>

        <div className="flex-1" />

        {/* Location input */}
        <input
          type="text"
          value={activeScript.value.location || ''}
          onChange={(e) => handleLocationChange(e.target.value)}
          placeholder="./ScriptName.csx"
          className="px-2 py-1 text-[11px] font-mono border border-slate-200/60 rounded-lg bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all w-52 placeholder:text-slate-300"
        />

        {/* API Reference toggle */}
        <button
          onClick={() => setShowReference(!showReference)}
          className={`p-1.5 rounded-lg transition-all ${
            showReference
              ? 'text-indigo-600 bg-indigo-50'
              : 'text-slate-400 hover:text-indigo-500 hover:bg-slate-100'
          }`}
          title="API Reference"
        >
          <BookOpen size={14} />
        </button>

        {/* Maximize/Restore */}
        <button
          onClick={() => setIsMaximized(!isMaximized)}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>

        {/* Close */}
        <button
          onClick={handleClose}
          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>

      {/* Snippet toolbar — horizontal, above editor */}
      <div className="border-b border-slate-100 bg-slate-50/30 shrink-0">
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
          <div className="w-64 shrink-0 border-l border-slate-100 overflow-y-auto">
            <CsxReferencePanel
              onClose={() => setShowReference(false)}
              onInsert={handleReferenceInsert}
            />
          </div>
        )}
      </div>

      {/* Bottom status bar */}
      <div className="flex items-center justify-between px-3 py-1 border-t border-slate-100 bg-slate-50/30 shrink-0">
        <span className="text-[10px] text-slate-400 font-mono">
          {decoded.split('\n').length} lines &middot; {activeScript.templateType}
        </span>
        <span className="text-[10px] text-slate-400 font-mono">
          C# Script &middot; UTF-8
        </span>
      </div>
    </div>
  );
}
