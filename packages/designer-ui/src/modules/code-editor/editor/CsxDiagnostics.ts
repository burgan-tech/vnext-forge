import { maskCsxNonCode, scriptCallerIssues, type ScriptCallerSurface } from '@vnext-forge-studio/vnext-types';

import type { TemplateType } from './CsxTemplates';

/* ────────────── CSX Script Diagnostics ────────────── */

interface DiagnosticMarker {
  startLineNumber: number;
  endLineNumber: number;
  startColumn: number;
  endColumn: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Members and types the runtime's script sandbox refuses at compile time
 * (`BannedApiAnalyzer`, runtime 0.0.102, docs `custom-script-helpers.md`).
 * The runtime compile error reads `banned member '<member>'`; matching here is
 * textual, so the reflection names (which could belong to a user type) are
 * warnings and the unambiguous ones errors.
 */
const SANDBOX_RULES: { pattern: RegExp; member: (m: RegExpExecArray) => string; severity: 'error' | 'warning'; why: string }[] = [
  {
    pattern: /(?:(?<![\w.])|(?<=\bSystem\.IO\.))(File|FileInfo|Directory|DirectoryInfo|DriveInfo|Path|FileStream|UnmanagedMemoryStream)\s*[.(]/g,
    member: (m) => `System.IO.${m[1]}`,
    severity: 'error',
    why: 'scripts have no file system; process bytes with MemoryStream, GetFileAsync and PutFileAsync',
  },
  {
    pattern: /new\s+(StreamReader|StreamWriter)\s*\(\s*\$?@?"/g,
    member: (m) => `${m[1]}(string path)`,
    severity: 'error',
    why: 'opens a file by path; wrap a Stream instead',
  },
  {
    pattern: /(?:(?<![\w.])|(?<=\bSystem\.))Activator\s*\.\s*(?!CreateInstance\s*<)(\w+)/g,
    member: (m) => `Activator.${m[1]}`,
    severity: 'error',
    why: 'only Activator.CreateInstance<T>() is allowed',
  },
  {
    pattern: /(?:(?<![\w.])|(?<=\bSystem\.))Type\s*\.\s*(GetType|GetTypeFromProgID|GetTypeFromCLSID)\s*\(/g,
    member: (m) => `Type.${m[1]}`,
    severity: 'error',
    why: 'resolves a type by name',
  },
  {
    pattern: /(?:(?<![\w.])|(?<=\bSystem\.))Environment\s*\.\s*(Exit|FailFast|SetEnvironmentVariable)\s*\(/g,
    member: (m) => `Environment.${m[1]}`,
    severity: 'error',
    why: 'terminates the host or changes its environment',
  },
  {
    pattern: /\.\s*(GetMethods?|GetConstructors?|GetMembers?|GetFields?|GetEvents?|FindMembers|GetDefaultMembers|InvokeMember)\s*\(|\.\s*(TypeInitializer)\b/g,
    member: (m) => `Type.${m[1] ?? m[2]}`,
    severity: 'warning',
    why: 'reflection objects are banned on System.Type',
  },
];

/**
 * Blanks out comments and string/char literal contents, keeping offsets.
 * Shared with the caller-roles rule mirror in `@vnext-forge-studio/vnext-types`.
 */
export const maskNonCode = maskCsxNonCode;

/** Sandbox (banned API) markers for one script; comments and string contents are skipped. */
export function sandboxDiagnostics(code: string): DiagnosticMarker[] {
  const markers: DiagnosticMarker[] = [];
  maskNonCode(code).split('\n').forEach((source, index) => {
    for (const rule of SANDBOX_RULES) {
      rule.pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = rule.pattern.exec(source)) !== null) {
        markers.push({
          startLineNumber: index + 1,
          endLineNumber: index + 1,
          startColumn: match.index + 1,
          endColumn: match.index + match[0].length + 1,
          message: `banned member '${rule.member(match)}': ${rule.why} (the runtime refuses to compile this script).`,
          severity: rule.severity,
        });
      }
    }
  });
  return markers;
}

/** `context.Caller` (runtime 0.0.105) markers for one script on `surface`. */
export function callerRoleDiagnostics(code: string, surface: ScriptCallerSurface | undefined): DiagnosticMarker[] {
  return scriptCallerIssues(code, surface).map((issue) => ({
    startLineNumber: issue.line,
    endLineNumber: issue.line,
    startColumn: issue.column,
    endColumn: issue.endColumn,
    message: issue.message,
    severity: issue.severity,
  }));
}

/**
 * Runs regex-based validation on a C# script and returns Monaco markers.
 * Called with 300ms debounce on editor content change.
 */
export function validateCsxScript(
  code: string,
  templateType: TemplateType,
  callerSurface?: ScriptCallerSurface,
): DiagnosticMarker[] {
  if (!code || code.trim().length === 0) return [];

  const lines = code.split('\n');
  const markers: DiagnosticMarker[] = [...sandboxDiagnostics(code), ...callerRoleDiagnostics(code, callerSurface)];

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
export function applyDiagnostics(
  monaco: any,
  model: any,
  code: string,
  templateType: TemplateType,
  callerSurface?: ScriptCallerSurface,
) {
  const markers = validateCsxScript(code, templateType, callerSurface);

  const monacoMarkers = markers.map((m) => ({
    startLineNumber: m.startLineNumber,
    endLineNumber: m.endLineNumber,
    startColumn: m.startColumn,
    endColumn: m.endColumn,
    message: m.message,
    severity: m.severity === 'error'
      ? monaco.MarkerSeverity.Error
      : m.severity === 'warning'
        ? monaco.MarkerSeverity.Warning
        : monaco.MarkerSeverity.Info,
  }));

  monaco.editor.setModelMarkers(model, 'csx-lint', monacoMarkers);
}
