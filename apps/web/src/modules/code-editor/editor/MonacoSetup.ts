import type { Monaco } from '@monaco-editor/react';
import { createLogger } from '@shared/lib/logger/createLogger';
import { registerContextAwareCompletions } from './CsxCompletions';
import { configureJsonSchemaValidation } from './JsonSchemaSetup';
import { createCsharpLspClient, type CsharpLspClient } from './lspClient';

const logger = createLogger('MonacoSetup');

let staticProvidersRegistered = false;

export function registerCSharpSnippets(monaco: Monaco) {
  monaco.languages.registerCompletionItemProvider('csharp', {
    triggerCharacters: [':'],
    provideCompletionItems: (model: any, position: any) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      return {
        suggestions: [
          {
            label: 'IMapping template',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: [
              'public class ${1:MappingName} : ScriptBase, IMapping',
              '{',
              '    public async Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)',
              '    {',
              '        $2',
              '        return new ScriptResponse();',
              '    }',
              '',
              '    public async Task<ScriptResponse> OutputHandler(ScriptContext context)',
              '    {',
              '        $3',
              '        return new ScriptResponse();',
              '    }',
              '}',
            ].join('\n'),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'IMapping (Input + Output)',
            range,
          },
          {
            label: 'IConditionMapping template',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: [
              'public class ${1:ConditionName} : ScriptBase, IConditionMapping',
              '{',
              '    public async Task<bool> Handler(ScriptContext context)',
              '    {',
              '        $2',
              '        return true;',
              '    }',
              '}',
            ].join('\n'),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'IConditionMapping (bool)',
            range,
          },
          {
            label: 'ITimerMapping template',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: [
              'public class ${1:TimerName} : ScriptBase, ITimerMapping',
              '{',
              '    public async Task<TimerSchedule> Handler(ScriptContext context)',
              '    {',
              '        $2',
              '        return TimerSchedule.FromDuration(TimeSpan.FromMinutes(5));',
              '    }',
              '}',
            ].join('\n'),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'ITimerMapping (TimerSchedule)',
            range,
          },
          {
            label: 'ITransitionMapping template',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: [
              'public class ${1:TransitionName} : ScriptBase, ITransitionMapping',
              '{',
              '    public async Task<ScriptResponse> Handler(ScriptContext context)',
              '    {',
              '        $2',
              '        return new ScriptResponse();',
              '    }',
              '}',
            ].join('\n'),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'ITransitionMapping',
            range,
          },
          {
            label: 'ISubFlowMapping template',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: [
              'public class ${1:SubFlowName} : ScriptBase, ISubFlowMapping',
              '{',
              '    public async Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)',
              '    {',
              '        $2',
              '        return new ScriptResponse();',
              '    }',
              '',
              '    public async Task<ScriptResponse> OutputHandler(ScriptContext context)',
              '    {',
              '        $3',
              '        return new ScriptResponse();',
              '    }',
              '}',
            ].join('\n'),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'ISubFlowMapping (Input + Output)',
            range,
          },
          {
            label: 'ISubProcessMapping template',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: [
              'public class ${1:SubProcessName} : ScriptBase, ISubProcessMapping',
              '{',
              '    public async Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)',
              '    {',
              '        $2',
              '        return new ScriptResponse();',
              '    }',
              '}',
            ].join('\n'),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'ISubProcessMapping (Input only)',
            range,
          },
        ],
      };
    },
  });
}

export function setupMonaco(monaco: Monaco) {
  registerContextAwareCompletions(monaco);
  registerCSharpSnippets(monaco);
  void configureJsonSchemaValidation(monaco);
}

/**
 * Sets up Monaco with both static completions (always active as fallback)
 * and the Roslyn LSP client (connected to OmniSharp on the server).
 *
 * Returns a disposable LSP client handle. Call dispose() on editor unmount.
 * If the LSP connection fails, static completions continue to work.
 */
export async function setupMonacoWithLsp(
  monaco: Monaco,
  sessionId: string,
): Promise<CsharpLspClient | null> {
  // Static completions — register only once per Monaco instance (module-level guard)
  if (!staticProvidersRegistered) {
    registerContextAwareCompletions(monaco);
    registerCSharpSnippets(monaco);
    staticProvidersRegistered = true;
  }

  const client = createCsharpLspClient(monaco, sessionId);
  try {
    await client.start();
    return client;
  } catch (err: any) {
    logger.warn('Roslyn LSP unavailable — using static completions only', { err: err?.message });
    return null;
  }
}
