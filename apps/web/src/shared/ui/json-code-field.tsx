import * as React from 'react';
import MonacoEditor from '@monaco-editor/react';

import { cn } from '@shared/lib/utils/cn';

interface JsonCodeFieldProps extends Omit<React.ComponentProps<'div'>, 'onChange'> {
  height?: number;
  language?: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  value: string;
}

function JsonCodeField({
  className,
  height = 160,
  language = 'json',
  onChange,
  readOnly = false,
  value,
  ...props
}: JsonCodeFieldProps) {
  return (
    <div
      data-slot="json-code-field"
      className={cn('border-input overflow-hidden rounded-md border', className)}
      style={{ height }}
      {...props}
    >
      <MonacoEditor
        height={height}
        language={language}
        value={value}
        onChange={(nextValue) => onChange(nextValue ?? '')}
        theme="vs"
        options={{
          folding: false,
          fontSize: 11,
          glyphMargin: false,
          lineDecorationsWidth: 0,
          lineNumbers: 'off',
          lineNumbersMinChars: 0,
          minimap: { enabled: false },
          overviewRulerLanes: 0,
          readOnly,
          renderLineHighlight: 'none',
          scrollBeyondLastLine: false,
          scrollbar: { horizontalScrollbarSize: 6, verticalScrollbarSize: 6 },
          tabSize: 2,
          wordWrap: 'on',
        }}
      />
    </div>
  );
}

export { JsonCodeField };
