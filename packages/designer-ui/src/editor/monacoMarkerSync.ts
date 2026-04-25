import type * as Monaco from 'monaco-editor';

import type { EditorMarkerIssue } from '../store/useEditorValidationStore.js';
import { useEditorValidationStore } from '../store/useEditorValidationStore.js';

/**
 * Subscribes to Monaco marker updates for the editor's model and mirrors them into
 * {@link useEditorValidationStore} for lightweight chrome (badges, status hints).
 */
export function subscribeMonacoModelMarkers(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco,
  fileKey: string,
): Monaco.IDisposable {
  const model = editor.getModel();
  if (!model) {
    return { dispose: () => {} };
  }

  const sync = () => {
    const raw = monaco.editor.getModelMarkers({ resource: model.uri });
    const markers: EditorMarkerIssue[] = raw.map((m) => ({
      severity:
        m.severity === monaco.MarkerSeverity.Error
          ? 'error'
          : m.severity === monaco.MarkerSeverity.Warning
            ? 'warning'
            : 'info',
      message: m.message,
      startLineNumber: m.startLineNumber,
      startColumn: m.startColumn,
      endLineNumber: m.endLineNumber,
      endColumn: m.endColumn,
    }));
    useEditorValidationStore.getState().setActiveFileMarkers(fileKey, markers);
  };

  sync();
  return monaco.editor.onDidChangeMarkers((uris) => {
    if (uris.some((u) => u.toString() === model.uri.toString())) sync();
  });
}
