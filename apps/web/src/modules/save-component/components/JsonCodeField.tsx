import { useRef, useCallback } from 'react';
import MonacoEditor from '@monaco-editor/react';

interface JsonCodeFieldProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  height?: number;
  readOnly?: boolean;
}

export function JsonCodeField({ value, onChange, language = 'json', height = 120, readOnly }: JsonCodeFieldProps) {
  const editorRef = useRef<any>(null);

  const handleMount = useCallback((editor: any) => {
    editorRef.current = editor;
  }, []);

  return (
    <div className="border border-border rounded overflow-hidden" style={{ height }}>
      <MonacoEditor
        height={height}
        language={language}
        value={value}
        onChange={(v) => onChange(v || '')}
        onMount={handleMount}
        theme="vs"
        options={{
          minimap: { enabled: false },
          lineNumbers: 'off',
          scrollBeyondLastLine: false,
          fontSize: 11,
          tabSize: 2,
          readOnly,
          wordWrap: 'on',
          folding: false,
          glyphMargin: false,
          lineDecorationsWidth: 0,
          lineNumbersMinChars: 0,
          renderLineHighlight: 'none',
          overviewRulerLanes: 0,
          scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
        }}
      />
    </div>
  );
}
