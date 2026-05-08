import type { Monaco } from '@monaco-editor/react';
import { createLogger } from '../../../lib/logger/createLogger';
import { registerContextAwareCompletions } from './CsxCompletions';
import { configureJsonSchemaValidation } from './JsonSchemaSetup';
import { createCsharpLspClient, type CsharpLspClient } from './lspClient';

const logger = createLogger('MonacoSetup');

let staticProvidersRegistered = false;

interface SnippetDef {
  label: string;
  prefix: string;
  detail: string;
  body: string[];
}

const CSX_SNIPPETS: SnippetDef[] = [
  // ── Class templates ──
  {
    label: 'IMapping template',
    prefix: 'vnext-mapping',
    detail: 'IMapping (Input + Output)',
    body: [
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
    ],
  },
  {
    label: 'IConditionMapping template',
    prefix: 'vnext-condition',
    detail: 'IConditionMapping (bool)',
    body: [
      'public class ${1:ConditionName} : ScriptBase, IConditionMapping',
      '{',
      '    public async Task<bool> Handler(ScriptContext context)',
      '    {',
      '        $2',
      '        return true;',
      '    }',
      '}',
    ],
  },
  {
    label: 'ITimerMapping template',
    prefix: 'vnext-timer',
    detail: 'ITimerMapping (TimerSchedule)',
    body: [
      'public class ${1:TimerName} : ScriptBase, ITimerMapping',
      '{',
      '    public async Task<TimerSchedule> Handler(ScriptContext context)',
      '    {',
      '        $2',
      '        return TimerSchedule.FromDuration(TimeSpan.FromMinutes(5));',
      '    }',
      '}',
    ],
  },
  {
    label: 'ITransitionMapping template',
    prefix: 'vnext-transition',
    detail: 'ITransitionMapping',
    body: [
      'public class ${1:TransitionName} : ScriptBase, ITransitionMapping',
      '{',
      '    public async Task<ScriptResponse> Handler(ScriptContext context)',
      '    {',
      '        $2',
      '        return new ScriptResponse();',
      '    }',
      '}',
    ],
  },
  {
    label: 'ISubFlowMapping template',
    prefix: 'vnext-subflow',
    detail: 'ISubFlowMapping (Input + Output)',
    body: [
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
    ],
  },
  {
    label: 'ISubProcessMapping template',
    prefix: 'vnext-subprocess',
    detail: 'ISubProcessMapping (Input only)',
    body: [
      'public class ${1:SubProcessName} : ScriptBase, ISubProcessMapping',
      '{',
      '    public async Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)',
      '    {',
      '        $2',
      '        return new ScriptResponse();',
      '    }',
      '}',
    ],
  },

  // ── Inline utility snippets ──
  {
    label: 'HttpTask setup',
    prefix: 'vnext-http',
    detail: 'Cast to HttpTask with URL, headers, body',
    body: [
      'var httpTask = task as HttpTask;',
      'if (httpTask == null)',
      '{',
      '    LogError("${1:ClassName}: Task must be an HttpTask");',
      '    return new ScriptResponse();',
      '}',
      '',
      'var baseUrl = GetConfigValue("${2:Domain:Service:BaseUrl}");',
      'httpTask.SetUrl(\\$"{baseUrl}/${3:api/endpoint}");',
      'httpTask.SetBody(new',
      '{',
      '    ${4:property} = context.Instance?.Data?.${5:fieldName}',
      '});',
      'httpTask.SetHeaders(new Dictionary<string, string?>',
      '{',
      '    ["Content-Type"] = "application/json"$0',
      '});',
    ],
  },
  {
    label: 'HTTP response parse',
    prefix: 'vnext-response',
    detail: 'Parse HTTP response with status check',
    body: [
      'var statusCode = (int)(context.Body?.statusCode ?? 200);',
      'var responseData = context.Body?.data ?? context.Body;',
      '',
      'if (statusCode >= 200 && statusCode < 300)',
      '{',
      '    LogInformation("${1:ClassName}: Success \\u2014 statusCode={0}", args: new object?[] { statusCode });',
      '    return new ScriptResponse',
      '    {',
      '        Data = new',
      '        {',
      '            ${2:result} = responseData?.${3:fieldName}$0',
      '        }',
      '    };',
      '}',
      'else',
      '{',
      '    var errorMessage = responseData?.message?.ToString() ?? "Unknown error";',
      '    LogWarning("${1}: Failed \\u2014 statusCode={0}, error={1}", args: new object?[] { statusCode, errorMessage });',
      '    return new ScriptResponse',
      '    {',
      '        Data = new { errorCode = statusCode.ToString(), errorMessage }',
      '    };',
      '}',
    ],
  },
  {
    label: 'Try/catch with logging',
    prefix: 'vnext-trycatch',
    detail: 'Try/catch block with logging and safe return',
    body: [
      'try',
      '{',
      '    $0',
      '}',
      'catch (Exception ex)',
      '{',
      '    LogError("${1:ClassName}: ${2:handler} error \\u2014 {0}", args: new object?[] { ex.Message });',
      '    return ${3:new ScriptResponse()};',
      '}',
    ],
  },
  {
    label: 'Config with secret fallback',
    prefix: 'vnext-config',
    detail: 'Get configuration value with secret fallback',
    body: [
      'var ${1:value} = GetConfigValue("${2:Domain:Service:Setting}");',
      'if (string.IsNullOrEmpty(${1:value}))',
      '{',
      '    ${1:value} = await GetSecretAsync("${3:vnext-secret}", "${4:workflow-secret}", "${2:Domain:Service:Setting}");',
      '}$0',
    ],
  },
  {
    label: 'HasProperty check',
    prefix: 'vnext-hasprop',
    detail: 'Check property existence before access',
    body: [
      'if (HasProperty(context.Instance?.Data, "${1:propertyName}"))',
      '{',
      '    var ${2:value} = context.Instance.Data.${1:propertyName}?.ToString();',
      '    $0',
      '}',
    ],
  },
  {
    label: 'Dynamic array manipulation',
    prefix: 'vnext-array',
    detail: 'Safely convert and modify dynamic arrays',
    body: [
      'var ${1:items} = new List<dynamic>();',
      'if (HasProperty(context.Instance?.Data, "${2:listProperty}"))',
      '{',
      '    ${1:items} = ((IEnumerable<dynamic>)context.Instance.Data.${2:listProperty}).ToList();',
      '}',
      '${1:items}.Add(new',
      '{',
      '    ${3:property} = ${4:value},',
      '    timestamp = DateTime.UtcNow',
      '});',
      '',
      'return new ScriptResponse',
      '{',
      '    Data = new { ${2:listProperty} = ${1:items} }',
      '};$0',
    ],
  },
  {
    label: 'Log message',
    prefix: 'vnext-log',
    detail: 'Formatted logging with arguments',
    body: [
      'LogInformation("${1:ClassName}: ${2:message} \\u2014 {0}", args: new object?[] { ${3:value} });$0',
    ],
  },
  {
    label: 'DaprPubSubTask setup',
    prefix: 'vnext-pubsub',
    detail: 'Cast to DaprPubSubTask with topic and data',
    body: [
      'var pubsubTask = task as DaprPubSubTask;',
      'if (pubsubTask == null)',
      '{',
      '    LogError("${1:ClassName}: Task must be a DaprPubSubTask");',
      '    return new ScriptResponse();',
      '}',
      '',
      'pubsubTask.SetPubSubName("${2:vnext-execution-pubsub}");',
      'pubsubTask.SetTopic("${3:domain.event-name}");',
      'pubsubTask.SetData(new',
      '{',
      '    eventType = "${4:EventName}",',
      '    instanceId = context.Instance?.Id?.ToString(),',
      '    timestamp = DateTime.UtcNow$0',
      '});',
    ],
  },
  {
    label: 'DaprServiceTask setup',
    prefix: 'vnext-service',
    detail: 'Cast to DaprServiceTask with app ID and method',
    body: [
      'var serviceTask = task as DaprServiceTask;',
      'if (serviceTask == null)',
      '{',
      '    LogError("${1:ClassName}: Task must be a DaprServiceTask");',
      '    return new ScriptResponse();',
      '}',
      '',
      'serviceTask.SetAppId("${2:target-app-id}");',
      'serviceTask.SetMethodName("${3:api/method}");',
      'serviceTask.SetData(new',
      '{',
      '    ${4:key} = ${5:context.Instance?.Data?.fieldName}$0',
      '});',
    ],
  },
  {
    label: 'ScriptResponse with Data',
    prefix: 'vnext-return',
    detail: 'Return ScriptResponse with Data payload',
    body: [
      'return new ScriptResponse',
      '{',
      '    Data = new',
      '    {',
      '        ${1:property} = ${2:value}$0',
      '    }',
      '};',
    ],
  },
  {
    label: 'GetInstanceDataTask setup',
    prefix: 'vnext-getinstance',
    detail: 'Cast to GetInstanceDataTask and fetch data by key',
    body: [
      'var instanceTask = task as GetInstanceDataTask;',
      'if (instanceTask == null)',
      '{',
      '    LogError("${1:ClassName}: Task must be a GetInstanceDataTask");',
      '    return new ScriptResponse();',
      '}',
      '',
      'var targetKey = context.Instance?.Data?.${2:targetKey}?.ToString();',
      'if (!string.IsNullOrEmpty(targetKey))',
      '{',
      '    instanceTask.SetKey(targetKey);',
      '}',
      '// instanceTask.SetDomain("${3:domain}");',
      '// instanceTask.SetFlow("${4:flow}");$0',
    ],
  },
  {
    label: 'ScriptResponse (inline)',
    prefix: 'vnext-scriptresponse',
    detail: 'Create a ScriptResponse with Data payload',
    body: [
      'new ScriptResponse',
      '{',
      '    Data = new',
      '    {',
      '        $1',
      '    }',
      '}',
    ],
  },

  // ── Task.FromResult return patterns ──
  {
    label: 'Task.FromResult (ScriptResponse)',
    prefix: 'vnext-fromresult',
    detail: 'Return with Task.FromResult (non-async)',
    body: [
      'return Task.FromResult(new ScriptResponse',
      '{',
      '    Data = new',
      '    {',
      '        ${1:property} = ${2:value}$0',
      '    }',
      '});',
    ],
  },
  {
    label: 'Task.FromResult (bool)',
    prefix: 'vnext-fromresult-bool',
    detail: 'Return bool with Task.FromResult (non-async condition)',
    body: [
      'return Task.FromResult(${1:true});$0',
    ],
  },
  {
    label: 'Task.FromResult (TimerSchedule)',
    prefix: 'vnext-fromresult-timer',
    detail: 'Return TimerSchedule with Task.FromResult (non-async timer)',
    body: [
      'return Task.FromResult(TimerSchedule.FromDuration(TimeSpan.From${1:Minutes}(${2:5})));$0',
    ],
  },
];

export function registerCSharpSnippets(monaco: Monaco) {
  monaco.languages.registerCompletionItemProvider('csharp', {
    triggerCharacters: ['-'],
    provideCompletionItems: (model: any, position: any) => {
      const lineContent = model.getLineContent(position.lineNumber);
      const textBeforeCursor = lineContent.substring(0, position.column - 1);

      const prefixMatch = textBeforeCursor.match(/(vnext[\w-]*)$/);
      const word = model.getWordUntilPosition(position);

      const startColumn = prefixMatch
        ? position.column - prefixMatch[1].length
        : word.startColumn;

      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn,
        endColumn: word.endColumn,
      };

      return {
        suggestions: CSX_SNIPPETS.map((s) => ({
          label: { label: s.prefix, description: s.label },
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: s.body.join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: s.detail,
          filterText: s.prefix,
          sortText: '0_' + s.prefix,
          range,
        })),
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
  options?: { disableLsp?: boolean },
): Promise<CsharpLspClient | null> {
  // Static completions — register only once per Monaco instance (module-level guard)
  if (!staticProvidersRegistered) {
    registerContextAwareCompletions(monaco);
    registerCSharpSnippets(monaco);
    staticProvidersRegistered = true;
  }

  if (options?.disableLsp) {
    return null;
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
