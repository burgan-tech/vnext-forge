import { type ChangeEvent, type ReactNode, useCallback, useState } from 'react';

interface CopyableJsonBlockProps {
  value: unknown;
  maxHeight?: string;
}

export function CopyableJsonBlock({ value, maxHeight }: CopyableJsonBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);

  return (
    <div className="group relative overflow-x-auto rounded bg-[var(--vscode-textCodeBlock-background)] p-2 text-[11px]">
      <button
        type="button"
        className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--vscode-list-hoverBackground)]"
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
      <pre className={`whitespace-pre-wrap ${maxHeight ? `max-h-[${maxHeight}] overflow-y-auto` : ''}`}>
        <JsonHighlighter value={value} />
      </pre>
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

export function JsonHighlighter({ value }: { value: unknown }) {
  const lines = renderJsonLines(value, 0);
  return <>{lines}</>;
}

type JsonNode = ReactNode;

function renderJsonLines(value: unknown, indent: number): JsonNode[] {
  const pad = '  '.repeat(indent);

  if (value === null) {
    return [<span key="null" style={{ color: 'var(--vscode-debugTokenExpression-name, #569cd6)' }}>null</span>];
  }

  if (typeof value === 'boolean') {
    return [<span key="bool" style={{ color: 'var(--vscode-debugTokenExpression-name, #569cd6)' }}>{String(value)}</span>];
  }

  if (typeof value === 'number') {
    return [<span key="num" style={{ color: 'var(--vscode-debugTokenExpression-number, #b5cea8)' }}>{String(value)}</span>];
  }

  if (typeof value === 'string') {
    return [<span key="str" style={{ color: 'var(--vscode-debugTokenExpression-string, #ce9178)' }}>{`"${escapeJsonString(value)}"`}</span>];
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return [<span key="arr">{'[]'}</span>];
    const result: JsonNode[] = [];
    result.push('[\n');
    value.forEach((item, i) => {
      result.push(pad + '  ');
      result.push(...renderJsonLines(item, indent + 1));
      if (i < value.length - 1) result.push(',');
      result.push('\n');
    });
    result.push(pad + ']');
    return result;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return [<span key="obj">{'{}'}</span>];
    const result: JsonNode[] = [];
    result.push('{\n');
    entries.forEach(([key, val], i) => {
      result.push(pad + '  ');
      result.push(
        <span key={`k-${key}`} style={{ color: 'var(--vscode-symbolIcon-propertyForeground, #9cdcfe)' }}>
          {`"${escapeJsonString(key)}"`}
        </span>,
      );
      result.push(': ');
      result.push(...renderJsonLines(val, indent + 1));
      if (i < entries.length - 1) result.push(',');
      result.push('\n');
    });
    result.push(pad + '}');
    return result;
  }

  return [String(value)];
}

function escapeJsonString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
}

interface JsonEditorWithCopyProps {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  label?: string;
}

export function JsonEditorWithCopy({ value, onChange, rows = 8, label }: JsonEditorWithCopyProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value),
    [onChange],
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        {label && <label className="text-xs font-medium">{label}</label>}
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
      <textarea
        value={value}
        onChange={handleChange}
        rows={rows}
        className="rounded border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] px-2 py-1.5 font-mono text-[11px] text-[var(--vscode-input-foreground)]"
      />
    </div>
  );
}
