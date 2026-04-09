import type { TemplateType } from './csx-templates';

/* ────────────── CSX Script Diagnostics ────────────── */

interface DiagnosticMarker {
  startLineNumber: number;
  endLineNumber: number;
  startColumn: number;
  endColumn: number;
  message: string;
  severity: 'warning' | 'info';
}

/**
 * Runs regex-based validation on a C# script and returns Monaco markers.
 * Called with 300ms debounce on editor content change.
 */
export function validateCsxScript(
  code: string,
  templateType: TemplateType,
): DiagnosticMarker[] {
  if (!code || code.trim().length === 0) return [];

  const lines = code.split('\n');
  const markers: DiagnosticMarker[] = [];

  // ── Rule 1: Condition/Rule missing return true/false ──
  if (templateType === 'condition') {
    const hasReturnTrue = code.includes('return true');
    const hasReturnFalse = code.includes('return false');
    if (!hasReturnTrue && !hasReturnFalse) {
      // Find the Handler method line
      const handlerLine = lines.findIndex((l) => /Handler\s*\(/.test(l) && !l.includes('InputHandler') && !l.includes('OutputHandler'));
      if (handlerLine >= 0) {
        markers.push({
          startLineNumber: handlerLine + 1,
          endLineNumber: handlerLine + 1,
          startColumn: 1,
          endColumn: lines[handlerLine].length + 1,
          message: 'Handler should return true or false for condition evaluation',
          severity: 'warning',
        });
      }
    }
  }

  // ── Rule 2: InputHandler without task casting ──
  if (templateType === 'mapping') {
    let inInputHandler = false;
    let inputHandlerStart = -1;
    let foundTaskCast = false;
    let braceCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('InputHandler(')) {
        inInputHandler = true;
        inputHandlerStart = i;
        braceCount = 0;
        foundTaskCast = false;
      }
      if (inInputHandler) {
        braceCount += (line.match(/\{/g) || []).length;
        braceCount -= (line.match(/\}/g) || []).length;
        if (line.includes('task as ') || line.includes('task.')) foundTaskCast = true;
        if (braceCount <= 0 && inputHandlerStart >= 0 && i > inputHandlerStart) {
          if (!foundTaskCast && inputHandlerStart >= 0) {
            markers.push({
              startLineNumber: inputHandlerStart + 1,
              endLineNumber: inputHandlerStart + 1,
              startColumn: 1,
              endColumn: lines[inputHandlerStart].length + 1,
              message: 'InputHandler receives a task parameter — did you mean to cast and configure it?',
              severity: 'info',
            });
          }
          inInputHandler = false;
        }
      }
    }
  }

  // ── Rule 3: Async without await ──
  const hasAsync = code.includes('async Task');
  const hasAwait = code.includes('await ');
  if (hasAsync && !hasAwait) {
    const asyncLine = lines.findIndex((l) => l.includes('async Task'));
    if (asyncLine >= 0) {
      markers.push({
        startLineNumber: asyncLine + 1,
        endLineNumber: asyncLine + 1,
        startColumn: 1,
        endColumn: lines[asyncLine].length + 1,
        message: 'Async method without await — consider removing async or adding an await call',
        severity: 'info',
      });
    }
  }

  // ── Rule 4: Long script without try/catch ──
  const codeLines = lines.filter((l) => l.trim().length > 0 && !l.trim().startsWith('//') && !l.trim().startsWith('using'));
  if (codeLines.length > 15 && !code.includes('try') && !code.includes('catch')) {
    markers.push({
      startLineNumber: 1,
      endLineNumber: 1,
      startColumn: 1,
      endColumn: lines[0].length + 1,
      message: 'Consider wrapping logic in try/catch for error resilience',
      severity: 'info',
    });
  }

  // ── Rule 5: Instance.Data access without HasProperty ──
  const dataAccessRegex = /context\.Instance\.Data\.(\w+)/g;
  const hasPropertyRegex = /HasProperty\(.*?,\s*"(\w+)"\)/g;

  const accessedProps = new Set<string>();
  const checkedProps = new Set<string>();

  let match;
  while ((match = dataAccessRegex.exec(code)) !== null) {
    accessedProps.add(match[1]);
  }
  while ((match = hasPropertyRegex.exec(code)) !== null) {
    checkedProps.add(match[1]);
  }

  for (const prop of accessedProps) {
    if (!checkedProps.has(prop)) {
      // Find the line where this property is first accessed
      const propLine = lines.findIndex((l) => l.includes(`context.Instance.Data.${prop}`));
      if (propLine >= 0) {
        markers.push({
          startLineNumber: propLine + 1,
          endLineNumber: propLine + 1,
          startColumn: 1,
          endColumn: lines[propLine].length + 1,
          message: `Consider using HasProperty() before accessing '${prop}' for safe dynamic access`,
          severity: 'info',
        });
      }
    }
  }

  return markers;
}

/**
 * Apply diagnostic markers to a Monaco editor model.
 */
export function applyDiagnostics(monaco: any, model: any, code: string, templateType: TemplateType) {
  const markers = validateCsxScript(code, templateType);

  const monacoMarkers = markers.map((m) => ({
    startLineNumber: m.startLineNumber,
    endLineNumber: m.endLineNumber,
    startColumn: m.startColumn,
    endColumn: m.endColumn,
    message: m.message,
    severity: m.severity === 'warning'
      ? monaco.MarkerSeverity.Warning
      : monaco.MarkerSeverity.Info,
  }));

  monaco.editor.setModelMarkers(model, 'csx-lint', monacoMarkers);
}
