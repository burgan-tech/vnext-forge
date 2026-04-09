import type { Monaco } from '@monaco-editor/react';

/* ────────────── Scope Detection ────────────── */

type HandlerScope = 'InputHandler' | 'OutputHandler' | 'Handler' | null;
type InterfaceType = 'IMapping' | 'IConditionMapping' | 'ITimerMapping' | 'ITransitionMapping' | 'ISubFlowMapping' | 'ISubProcessMapping' | null;

function detectHandlerScope(model: any, position: any): HandlerScope {
  for (let line = position.lineNumber; line >= 1; line--) {
    const text = model.getLineContent(line);
    if (text.includes('InputHandler(')) return 'InputHandler';
    if (text.includes('OutputHandler(')) return 'OutputHandler';
    if (/Handler\s*\(/.test(text) && !text.includes('InputHandler') && !text.includes('OutputHandler')) return 'Handler';
  }
  return null;
}

function detectInterfaceType(model: any): InterfaceType {
  const fullText = model.getValue().substring(0, 500); // First 500 chars
  if (fullText.includes('IConditionMapping')) return 'IConditionMapping';
  if (fullText.includes('ITimerMapping')) return 'ITimerMapping';
  if (fullText.includes('ITransitionMapping')) return 'ITransitionMapping';
  if (fullText.includes('ISubFlowMapping')) return 'ISubFlowMapping';
  if (fullText.includes('ISubProcessMapping')) return 'ISubProcessMapping';
  if (fullText.includes('IMapping')) return 'IMapping';
  return null;
}

/* ────────────── Dot-Trigger Word Detection ────────────── */

function getWordBeforeDot(model: any, position: any): string | null {
  const lineContent = model.getLineContent(position.lineNumber);
  const beforeCursor = lineContent.substring(0, position.column - 1);

  // Match "word." or "word.word." patterns
  const match = beforeCursor.match(/([\w.]+)\.$/);
  return match ? match[1] : null;
}

/* ────────────── Completion Items with Documentation ────────────── */

interface CompletionDef {
  label: string;
  kind: 'Method' | 'Property' | 'Class' | 'Snippet' | 'Field' | 'Value';
  insertText: string;
  isSnippet?: boolean;
  detail: string;
  documentation?: string;
}

// ScriptBase methods
const SCRIPT_BASE_METHODS: CompletionDef[] = [
  { label: 'LogInformation', kind: 'Method', insertText: 'LogInformation("${1:message}", args: new object?[] { ${2} });', isSnippet: true, detail: 'ScriptBase', documentation: 'Logs an informational message.\n\n```csharp\nLogInformation("Processing user={0}", args: new object?[] { userId });\n```' },
  { label: 'LogWarning', kind: 'Method', insertText: 'LogWarning("${1:message}", args: new object?[] { ${2} });', isSnippet: true, detail: 'ScriptBase', documentation: 'Logs a warning message.\n\n```csharp\nLogWarning("Retry count exceeded: {0}", args: new object?[] { count });\n```' },
  { label: 'LogError', kind: 'Method', insertText: 'LogError("${1:message}", args: new object?[] { ${2} });', isSnippet: true, detail: 'ScriptBase', documentation: 'Logs an error message.\n\n```csharp\nLogError("Failed: {0}", args: new object?[] { ex.Message });\n```' },
  { label: 'LogDebug', kind: 'Method', insertText: 'LogDebug("${1:message}", args: new object?[] { ${2} });', isSnippet: true, detail: 'ScriptBase', documentation: 'Logs a debug message.' },
  { label: 'LogTrace', kind: 'Method', insertText: 'LogTrace("${1:message}", args: new object?[] { ${2} });', isSnippet: true, detail: 'ScriptBase', documentation: 'Logs a trace message.' },
  { label: 'LogCritical', kind: 'Method', insertText: 'LogCritical("${1:message}", args: new object?[] { ${2} });', isSnippet: true, detail: 'ScriptBase', documentation: 'Logs a critical error message.' },
  { label: 'HasProperty', kind: 'Method', insertText: 'HasProperty(${1:obj}, "${2:propertyName}")', isSnippet: true, detail: 'ScriptBase → bool', documentation: 'Checks if a dynamic object has a property.\n\n```csharp\nif (HasProperty(context.Instance?.Data, "userId"))\n{\n    var userId = context.Instance.Data.userId;\n}\n```' },
  { label: 'GetPropertyValue', kind: 'Method', insertText: 'GetPropertyValue(${1:obj}, "${2:propertyName}")', isSnippet: true, detail: 'ScriptBase → object?', documentation: 'Gets a property value safely from a dynamic object.\n\n```csharp\nvar value = GetPropertyValue(data, "fieldName");\n```' },
  { label: 'GetConfigValue', kind: 'Method', insertText: 'GetConfigValue("${1:key}")', isSnippet: true, detail: 'ScriptBase → string?', documentation: 'Gets a configuration value by key.\n\n```csharp\nvar baseUrl = GetConfigValue("MyDomain:Service:BaseUrl");\n```' },
  { label: 'GetSecretAsync', kind: 'Method', insertText: 'await GetSecretAsync("${1:storeName}", "${2:secretStore}", "${3:secretKey}")', isSnippet: true, detail: 'ScriptBase → Task<string>', documentation: 'Gets a secret value asynchronously.\n\n```csharp\nvar apiKey = await GetSecretAsync("vnext-secret", "workflow-secret", "api-key");\n```' },
  { label: 'GetSecret', kind: 'Method', insertText: 'GetSecret("${1:storeName}", "${2:secretStore}", "${3:secretKey}")', isSnippet: true, detail: 'ScriptBase → string', documentation: 'Gets a secret value synchronously.' },
  { label: 'ConfigExists', kind: 'Method', insertText: 'ConfigExists("${1:key}")', isSnippet: true, detail: 'ScriptBase → bool', documentation: 'Checks if a configuration key exists.' },
  { label: 'GetConnectionString', kind: 'Method', insertText: 'GetConnectionString("${1:name}")', isSnippet: true, detail: 'ScriptBase → string?', documentation: 'Gets a database connection string by name.' },
];

// ScriptContext members (for dot-trigger after "context.")
const CONTEXT_MEMBERS: CompletionDef[] = [
  { label: 'Body', kind: 'Property', insertText: 'Body', detail: 'dynamic', documentation: 'Request payload data (camelCase). Access with `context.Body?.propertyName`.' },
  { label: 'Headers', kind: 'Property', insertText: 'Headers', detail: 'dynamic', documentation: 'Request headers (lowercase keys). Access with `context.Headers?.authorization`.' },
  { label: 'Instance', kind: 'Property', insertText: 'Instance', detail: 'Instance', documentation: 'Active workflow instance. Contains Data, Id, State, Key, Tags.' },
  { label: 'TaskResponse', kind: 'Property', insertText: 'TaskResponse', detail: 'Dictionary<string, dynamic?>', documentation: 'Results from completed tasks in the current state.' },
  { label: 'Transition', kind: 'Property', insertText: 'Transition', detail: 'Transition', documentation: 'Current state change information.' },
  { label: 'Workflow', kind: 'Property', insertText: 'Workflow', detail: 'Workflow', documentation: 'Workflow blueprint and structure definition.' },
  { label: 'Runtime', kind: 'Property', insertText: 'Runtime', detail: 'IRuntimeInfoProvider', documentation: 'Runtime environment and services.' },
  { label: 'Definitions', kind: 'Property', insertText: 'Definitions', detail: 'Dictionary<string, dynamic>', documentation: 'Reusable workflow component definitions.' },
  { label: 'MetaData', kind: 'Property', insertText: 'MetaData', detail: 'Dictionary<string, dynamic>', documentation: 'Execution metadata and performance metrics.' },
  { label: 'QueryParameters', kind: 'Property', insertText: 'QueryParameters', detail: 'dynamic', documentation: 'Query string parameters (Function tasks only).' },
  { label: 'RouteValues', kind: 'Property', insertText: 'RouteValues', detail: 'dynamic', documentation: 'URL path and query parameters.' },
];

// Instance members (for dot-trigger after "context.Instance.")
const INSTANCE_MEMBERS: CompletionDef[] = [
  { label: 'Data', kind: 'Property', insertText: 'Data', detail: 'dynamic', documentation: 'Instance data object. All properties are camelCase.\n\n```csharp\nvar userId = context.Instance?.Data?.userId;\n```' },
  { label: 'Id', kind: 'Property', insertText: 'Id', detail: 'Guid', documentation: 'Instance unique identifier.' },
  { label: 'State', kind: 'Property', insertText: 'State', detail: 'string', documentation: 'Current workflow state key.' },
  { label: 'Key', kind: 'Property', insertText: 'Key', detail: 'string', documentation: 'Instance key.' },
  { label: 'Tags', kind: 'Property', insertText: 'Tags', detail: 'string[]', documentation: 'Instance categorization tags.' },
];

// HttpTask methods
const HTTP_TASK_MEMBERS: CompletionDef[] = [
  { label: 'SetUrl', kind: 'Method', insertText: 'SetUrl(${1:url})', isSnippet: true, detail: 'void', documentation: 'Sets the HTTP request URL.\n\n```csharp\nhttpTask.SetUrl($"{baseUrl}/api/endpoint");\n```' },
  { label: 'SetBody', kind: 'Method', insertText: 'SetBody(${1:body})', isSnippet: true, detail: 'void', documentation: 'Sets the HTTP request body.\n\n```csharp\nhttpTask.SetBody(new { userId = "123", name = "John" });\n```' },
  { label: 'SetHeaders', kind: 'Method', insertText: 'SetHeaders(new Dictionary<string, string?>\n{\n    ${1}\n})', isSnippet: true, detail: 'void', documentation: 'Sets HTTP request headers.\n\n```csharp\nhttpTask.SetHeaders(new Dictionary<string, string?>\n{\n    ["Content-Type"] = "application/json",\n    ["Authorization"] = $"Bearer {token}"\n});\n```' },
  { label: 'Method', kind: 'Property', insertText: 'Method', detail: 'string', documentation: 'HTTP method (GET, POST, PUT, DELETE, PATCH). Direct assignment allowed.' },
];

// DaprPubSubTask methods
const PUBSUB_TASK_MEMBERS: CompletionDef[] = [
  { label: 'SetPubSubName', kind: 'Method', insertText: 'SetPubSubName("${1:vnext-execution-pubsub}")', isSnippet: true, detail: 'void', documentation: 'Sets the pub/sub component name.' },
  { label: 'SetTopic', kind: 'Method', insertText: 'SetTopic("${1:topic-name}")', isSnippet: true, detail: 'void', documentation: 'Sets the topic to publish to.' },
  { label: 'SetData', kind: 'Method', insertText: 'SetData(${1:data})', isSnippet: true, detail: 'void', documentation: 'Sets the event data payload.' },
  { label: 'SetMetadata', kind: 'Method', insertText: 'SetMetadata(${1:metadata})', isSnippet: true, detail: 'void', documentation: 'Sets additional metadata for the message.' },
];

// DaprServiceTask methods
const SERVICE_TASK_MEMBERS: CompletionDef[] = [
  { label: 'SetAppId', kind: 'Method', insertText: 'SetAppId("${1:app-id}")', isSnippet: true, detail: 'void', documentation: 'Sets the target Dapr app ID.' },
  { label: 'SetMethodName', kind: 'Method', insertText: 'SetMethodName("${1:api/method}")', isSnippet: true, detail: 'void', documentation: 'Sets the method/endpoint to invoke.' },
  { label: 'SetQueryString', kind: 'Method', insertText: 'SetQueryString("${1:key=value}")', isSnippet: true, detail: 'void', documentation: 'Sets the query string parameters.' },
  { label: 'SetData', kind: 'Method', insertText: 'SetData(${1:data})', isSnippet: true, detail: 'void', documentation: 'Sets the request data payload.' },
];

// TimerSchedule factory methods
const TIMER_SCHEDULE_MEMBERS: CompletionDef[] = [
  { label: 'FromDuration', kind: 'Method', insertText: 'FromDuration(TimeSpan.From${1:Minutes}(${2:5}))', isSnippet: true, detail: 'TimerSchedule', documentation: 'Creates a relative delay timer.\n\n```csharp\nTimerSchedule.FromDuration(TimeSpan.FromMinutes(5));\nTimerSchedule.FromDuration(TimeSpan.FromHours(1));\n```' },
  { label: 'FromDateTime', kind: 'Method', insertText: 'FromDateTime(${1:DateTime.UtcNow.AddHours(1)})', isSnippet: true, detail: 'TimerSchedule', documentation: 'Creates an absolute date/time timer.\n\n```csharp\nTimerSchedule.FromDateTime(DateTime.UtcNow.AddDays(1));\n```' },
  { label: 'FromCronExpression', kind: 'Method', insertText: 'FromCronExpression("${1:0 9 * * *}")', isSnippet: true, detail: 'TimerSchedule', documentation: 'Creates a cron-based timer.\n\n```csharp\nTimerSchedule.FromCronExpression("0 9 * * *"); // Daily at 9 AM\nTimerSchedule.FromCronExpression("0 */5 * * *"); // Every 5 hours\n```' },
  { label: 'Immediate', kind: 'Method', insertText: 'Immediate()', isSnippet: false, detail: 'TimerSchedule', documentation: 'Creates an immediate execution timer.' },
];

// ScriptResponse construction
const SCRIPT_RESPONSE_ITEMS: CompletionDef[] = [
  { label: 'ScriptResponse', kind: 'Class', insertText: 'new ScriptResponse\n{\n    Data = new\n    {\n        ${1}\n    }\n}', isSnippet: true, detail: 'Create ScriptResponse', documentation: 'Creates a ScriptResponse with Data payload.\n\nProperties: Data, Key, Headers, RouteValues, Tags' },
  { label: 'ScriptResponse (empty)', kind: 'Class', insertText: 'new ScriptResponse()', isSnippet: false, detail: 'Empty ScriptResponse', documentation: 'Creates an empty ScriptResponse (no data modifications).' },
];

/* ────────────── Build Monaco Completions ────────────── */

function toMonacoKind(kind: CompletionDef['kind'], monaco: Monaco): number {
  switch (kind) {
    case 'Method': return monaco.languages.CompletionItemKind.Method;
    case 'Property': return monaco.languages.CompletionItemKind.Property;
    case 'Class': return monaco.languages.CompletionItemKind.Class;
    case 'Snippet': return monaco.languages.CompletionItemKind.Snippet;
    case 'Field': return monaco.languages.CompletionItemKind.Field;
    case 'Value': return monaco.languages.CompletionItemKind.Value;
    default: return monaco.languages.CompletionItemKind.Text;
  }
}

function buildSuggestions(defs: CompletionDef[], range: any, monaco: Monaco) {
  return defs.map((d) => ({
    label: d.label,
    kind: toMonacoKind(d.kind, monaco),
    insertText: d.insertText,
    insertTextRules: d.isSnippet ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
    detail: d.detail,
    documentation: d.documentation ? { value: d.documentation, isTrusted: true } : undefined,
    range,
  }));
}

/* ────────────── Register Providers ────────────── */

export function registerContextAwareCompletions(monaco: Monaco) {
  // Main completion provider — context-aware based on handler scope
  monaco.languages.registerCompletionItemProvider('csharp', {
    provideCompletionItems: (model: any, position: any) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const scope = detectHandlerScope(model, position);
      const iface = detectInterfaceType(model);

      const suggestions: any[] = [];

      // Always provide ScriptBase methods
      suggestions.push(...buildSuggestions(SCRIPT_BASE_METHODS, range, monaco));

      // Always provide ScriptResponse
      suggestions.push(...buildSuggestions(SCRIPT_RESPONSE_ITEMS, range, monaco));

      // Scope-specific suggestions
      if (scope === 'InputHandler') {
        // Task casting suggestions
        const taskTypes = ['HttpTask', 'DaprPubSubTask', 'DaprServiceTask', 'DaprBindingTask', 'GetInstanceDataTask', 'GetInstancesTask', 'DirectTriggerTask', 'SubProcessTask'];
        suggestions.push(...taskTypes.map((t) => ({
          label: `task as ${t}`,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `var ${t.charAt(0).toLowerCase()}${t.slice(1)} = task as ${t};\nif (${t.charAt(0).toLowerCase()}${t.slice(1)} == null)\n{\n    LogError("Task must be a ${t}");\n    return new ScriptResponse();\n}\n$0`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Task Casting + null check',
          documentation: { value: `Cast task to ${t} with null safety check.`, isTrusted: true },
          range,
        })));
      }

      if (scope === 'OutputHandler') {
        // Response parsing helpers
        suggestions.push({
          label: 'Parse TaskResponse',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'var statusCode = (int)(context.Body?.statusCode ?? 200);\nvar responseData = context.Body?.data ?? context.Body;\n$0',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Response parsing pattern',
          documentation: { value: 'Common pattern for parsing HTTP response data from Body.', isTrusted: true },
          range,
        });
      }

      if (scope === 'Handler' && iface === 'IConditionMapping') {
        // Condition-specific
        suggestions.push(
          {
            label: 'Check Instance Data property',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'var data = context.Instance?.Data;\nif (!HasProperty(data, "${1:propertyName}"))\n{\n    LogWarning("Property \'${1}\' not found");\n    return false;\n}\nvar ${2:value} = data?.${1};\n$0',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'Safe property check pattern',
            range,
          },
          {
            label: 'return true',
            kind: monaco.languages.CompletionItemKind.Value,
            insertText: 'return true;',
            detail: 'Allow transition',
            range,
          },
          {
            label: 'return false',
            kind: monaco.languages.CompletionItemKind.Value,
            insertText: 'return false;',
            detail: 'Block transition',
            range,
          }
        );
      }

      if (scope === 'Handler' && iface === 'ITimerMapping') {
        // Timer-specific
        suggestions.push(...buildSuggestions(TIMER_SCHEDULE_MEMBERS.map((t) => ({
          ...t,
          insertText: `TimerSchedule.${t.insertText}`,
        })), range, monaco));
      }

      return { suggestions };
    },
  });

  // Dot-trigger completion provider
  monaco.languages.registerCompletionItemProvider('csharp', {
    triggerCharacters: ['.'],
    provideCompletionItems: (model: any, position: any) => {
      const wordBefore = getWordBeforeDot(model, position);
      if (!wordBefore) return { suggestions: [] };

      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: position.column,
        endColumn: position.column,
      };

      let members: CompletionDef[] = [];

      switch (wordBefore) {
        case 'context':
          members = CONTEXT_MEMBERS;
          break;
        case 'context.Instance':
          members = INSTANCE_MEMBERS;
          break;
        case 'httpTask':
        case 'http':
          members = HTTP_TASK_MEMBERS;
          break;
        case 'pubsubTask':
        case 'pubsub':
          members = PUBSUB_TASK_MEMBERS;
          break;
        case 'serviceTask':
        case 'service':
          members = SERVICE_TASK_MEMBERS;
          break;
        case 'TimerSchedule':
          members = TIMER_SCHEDULE_MEMBERS;
          break;
        default:
          // Try partial matches for common variable names
          if (wordBefore.toLowerCase().includes('http')) members = HTTP_TASK_MEMBERS;
          else if (wordBefore.toLowerCase().includes('pubsub')) members = PUBSUB_TASK_MEMBERS;
          else if (wordBefore.toLowerCase().includes('service') && wordBefore.toLowerCase().includes('task')) members = SERVICE_TASK_MEMBERS;
          break;
      }

      return { suggestions: buildSuggestions(members, range, monaco) };
    },
  });
}
