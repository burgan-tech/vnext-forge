import { useCallback, useRef, useState } from 'react';
import MonacoEditor, { type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

import { useResolvedColorTheme } from '../../../hooks/useResolvedColorTheme';

interface CopyableJsonBlockProps {
  value: unknown;
  maxHeight?: string;
  fillHeight?: boolean;
}

export function CopyableJsonBlock({ value, maxHeight, fillHeight }: CopyableJsonBlockProps) {
  const [copied, setCopied] = useState(false);
  const resolvedColorTheme = useResolvedColorTheme();
  const monacoTheme = resolvedColorTheme === 'dark' ? 'vs-dark' : 'vs';

  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  const lineCount = text.split('\n').length;
  const computedHeight = fillHeight
    ? undefined
    : Math.min(Math.max(lineCount * 19 + 8, 60), maxHeight ? parseInt(maxHeight, 10) || 300 : 300);

  const handleCopy = useCallback(() => {
    const copyText = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    void navigator.clipboard.writeText(copyText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);

  return (
    <div className={`group relative rounded bg-[var(--vscode-textCodeBlock-background)] text-[11px]${fillHeight ? ' flex-1 min-h-0' : ''}`}>
      <button
        type="button"
        className="absolute top-1 right-1 z-10 flex h-5 w-5 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--vscode-list-hoverBackground)]"
        onClick={handleCopy}
        title={copied ? 'Copied!' : 'Copy to clipboard'}
        aria-label="Copy JSON"
      >
        {copied ? (
          <span className="text-[10px] text-[var(--vscode-charts-green)]">✓</span>
        ) : (
          <CopyIcon />
        )}
      </button>
      <div style={fillHeight ? { height: '100%' } : { height: computedHeight }}>
        <MonacoEditor
          height="100%"
          language="json"
          value={text}
          theme={monacoTheme}
          options={{
            readOnly: true,
            padding: { top: 4, bottom: 4 },
            folding: true,
            showFoldingControls: 'always',
            fontSize: 11,
            glyphMargin: false,
            lineDecorationsWidth: 16,
            lineNumbers: 'off',
            lineNumbersMinChars: 0,
            minimap: { enabled: false },
            overviewRulerLanes: 0,
            renderLineHighlight: 'none',
            scrollBeyondLastLine: false,
            scrollbar: { horizontalScrollbarSize: 4, verticalScrollbarSize: 4 },
            tabSize: 2,
            wordWrap: 'on',
            domReadOnly: true,
            contextmenu: false,
          }}
        />
      </div>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="text-[var(--vscode-descriptionForeground)]">
      <path d="M4 4h1V2h7v7h-2v1h3V1H4v3zm-1 1h7v9H3V5zm1 1v7h5V6H4z" />
    </svg>
  );
}


interface JsonEditorWithCopyProps {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  label?: string;
}

export function JsonEditorWithCopy({ value, onChange, rows = 8, label }: JsonEditorWithCopyProps) {
  const [copied, setCopied] = useState(false);
  const [formatError, setFormatError] = useState<string | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const resolvedColorTheme = useResolvedColorTheme();
  const monacoTheme = resolvedColorTheme === 'dark' ? 'vs-dark' : 'vs';
  const height = Math.max(rows * 19, 100);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);

  const handleAutoFix = useCallback(() => {
    try {
      const parsed = JSON.parse(value);
      const formatted = JSON.stringify(parsed, null, 2);
      onChange(formatted);
      setFormatError(null);
    } catch {
      setFormatError('Invalid JSON — cannot format');
      setTimeout(() => setFormatError(null), 3000);
    }
  }, [value, onChange]);

  const handleMount = useCallback<OnMount>((editor) => {
    editorRef.current = editor;
  }, []);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        {label && <label className="text-xs font-medium">{label}</label>}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1 text-[10px] text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]"
            onClick={handleAutoFix}
            title="Format JSON"
            aria-label="Auto-fix JSON formatting"
          >
            <FormatIcon />
            <span>Auto-Fix</span>
          </button>
          <button
            type="button"
            className="flex items-center gap-1 text-[10px] text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]"
            onClick={handleCopy}
            title={copied ? 'Copied!' : 'Copy to clipboard'}
            aria-label="Copy JSON"
          >
            {copied ? (
              <span className="text-[var(--vscode-charts-green)]">Copied!</span>
            ) : (
              <>
                <CopyIcon />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
      {formatError && (
        <span className="text-[10px] text-[var(--vscode-errorForeground)]">{formatError}</span>
      )}
      <div
        className="overflow-hidden rounded border border-[var(--vscode-input-border)]"
        style={{ height }}
      >
        <MonacoEditor
          height="100%"
          language="json"
          value={value}
          onChange={(nextValue) => {
            const next = nextValue ?? '';
            if (next === value) return;
            onChange(next);
          }}
          onMount={handleMount}
          theme={monacoTheme}
          options={{
            padding: { top: 4, bottom: 4 },
            folding: true,
            showFoldingControls: 'always',
            fontSize: 11,
            glyphMargin: false,
            lineDecorationsWidth: 16,
            lineNumbers: 'off',
            lineNumbersMinChars: 0,
            minimap: { enabled: false },
            overviewRulerLanes: 0,
            renderLineHighlight: 'none',
            scrollBeyondLastLine: false,
            scrollbar: { horizontalScrollbarSize: 4, verticalScrollbarSize: 4 },
            tabSize: 2,
            wordWrap: 'on',
            editContext: false,
          }}
        />
      </div>
    </div>
  );
}

function FormatIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="text-[var(--vscode-descriptionForeground)]">
      <path d="M2 3h12v1H2V3zm2 3h8v1H4V6zm-1 3h10v1H3V9zm2 3h6v1H5v-1z" />
    </svg>
  );
}
