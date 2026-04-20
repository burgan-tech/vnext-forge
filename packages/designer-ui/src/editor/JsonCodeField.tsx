import * as React from 'react';
import MonacoEditor, { type OnMount } from '@monaco-editor/react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/utils/cn.js';
import { useEditorValidationStore } from '../store/useEditorValidationStore.js';
import { subscribeMonacoModelMarkers } from './monacoMarkerSync.js';

const jsonCodeFieldVariants = cva(
  'overflow-hidden rounded-xl border shadow-sm transition-all duration-200 ease-out',
  {
    variants: {
      variant: {
        default: 'border-primary-border bg-primary text-primary-foreground',
        secondary: 'border-secondary-border bg-secondary text-secondary-foreground',
        tertiary: 'border-tertiary-border bg-tertiary text-tertiary-foreground',
      },
      hoverable: {
        true: '',
        false: '',
      },
      noBorder: {
        true: 'border-0',
        false: '',
      },
      readOnly: {
        true: '',
        false: 'shadow-md',
      },
    },
    compoundVariants: [
      {
        variant: 'default',
        readOnly: false,
        className: 'border-primary-border-hover bg-primary-surface',
      },
      {
        variant: 'secondary',
        readOnly: false,
        className: 'border-secondary-border-hover bg-secondary-surface',
      },
      {
        variant: 'tertiary',
        readOnly: false,
        className: 'border-tertiary-border-hover bg-tertiary-surface',
      },
      {
        variant: 'default',
        hoverable: true,
        readOnly: false,
        className: 'hover:border-primary-border-hover hover:bg-primary-hover',
      },
      {
        variant: 'secondary',
        hoverable: true,
        readOnly: false,
        className: 'hover:border-secondary-border-hover hover:bg-secondary-hover',
      },
      {
        variant: 'tertiary',
        hoverable: true,
        readOnly: false,
        className: 'hover:border-tertiary-border-hover hover:bg-tertiary-hover',
      },
    ],
    defaultVariants: {
      variant: 'default',
      hoverable: false,
      noBorder: false,
      readOnly: false,
    },
  },
);

interface JsonCodeFieldProps
  extends
    Omit<React.ComponentProps<'div'>, 'onChange'>,
    VariantProps<typeof jsonCodeFieldVariants> {
  height?: number;
  language?: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  value: string;
  /** When set, used as the validation store key; otherwise the Monaco model URI is used. */
  validationFileKey?: string;
}

function JsonCodeField({
  className,
  height = 160,
  language = 'json',
  onChange,
  hoverable = false,
  noBorder = false,
  readOnly = false,
  variant,
  value,
  validationFileKey,
  ...props
}: JsonCodeFieldProps) {
  const markerDisposableRef = React.useRef<{ dispose: () => void } | null>(null);
  const [mountedKey, setMountedKey] = React.useState<string | null>(null);
  const activeFilePath = useEditorValidationStore((s) => s.activeFilePath);
  const markerCounts = useEditorValidationStore((s) => s.markerCounts);

  const handleMount = React.useCallback<OnMount>(
    (editor, monaco) => {
      markerDisposableRef.current?.dispose();
      const model = editor.getModel();
      const key = validationFileKey ?? model?.uri.toString() ?? 'json-code-field';
      setMountedKey(key);
      markerDisposableRef.current = subscribeMonacoModelMarkers(editor, monaco, key);
    },
    [validationFileKey],
  );

  React.useEffect(() => () => markerDisposableRef.current?.dispose(), []);

  const showMarkers = Boolean(mountedKey && activeFilePath === mountedKey);

  return (
    <div
      data-slot="json-code-field"
      className={cn(
        jsonCodeFieldVariants({ variant, hoverable, noBorder, readOnly }),
        'flex min-h-0 flex-col',
        className,
      )}
      style={{ height }}
      {...props}>
      {showMarkers && (markerCounts.errors > 0 || markerCounts.warnings > 0) && (
        <div className="text-muted-foreground flex h-[22px] shrink-0 items-center justify-end gap-2 border-b border-current/10 px-2 text-[10px] font-medium tabular-nums">
          {markerCounts.errors > 0 && (
            <span className="text-destructive">{markerCounts.errors} errors</span>
          )}
          {markerCounts.warnings > 0 && (
            <span className="text-amber-600 dark:text-amber-500">{markerCounts.warnings} warnings</span>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1">
        <MonacoEditor
          height="100%"
        language={language}
        value={value}
        onChange={(nextValue) => onChange(nextValue ?? '')}
        onMount={handleMount}
        theme="vs"
        options={{
          padding: { top: 4, bottom: 10 },
          folding: false,
          fontSize: 14,
          glyphMargin: true,
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
        className={cn('min-h-0', !readOnly && 'ring-1 ring-current/5')}
        />
      </div>
    </div>
  );
}

export { JsonCodeField, jsonCodeFieldVariants };
