import type { Monaco } from '@monaco-editor/react';
import {
  SCRIPT_CALLER_SURFACES,
  scriptCallerAvailable,
  type ScriptCallerSurface,
} from '@vnext-forge-studio/vnext-types';

/* ────────────── Caller-role surface per model ────────────── */

/**
 * The completion and hover providers are registered once per Monaco
 * instance; the script panel tells them which surface the model belongs to
 * (runtime 0.0.105 `context.Caller` availability). Absent = unknown surface.
 */
const modelCallerSurfaces = new WeakMap<object, ScriptCallerSurface | undefined>();

export function setCsxModelCallerSurface(model: object | null | undefined, surface: ScriptCallerSurface | undefined): void {
  if (model) modelCallerSurfaces.set(model, surface);
}

function callerSurfaceOf(model: object): ScriptCallerSurface | undefined {
  return modelCallerSurfaces.get(model);
}

/* ────────────── Scope Detection ────────────── */

type HandlerScope = 'InputHandler' | 'OutputHandler' | 'Handler' | null;
type InterfaceType = 'IMapping' | 'IConditionMapping' | 'ITimerMapping' | 'ITransitionMapping' | 'ISubFlowMapping' | 'ISubProcessMapping' | 'ICacheKeyMapping' | null;

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
  if (fullText.includes('ICacheKeyMapping')) return 'ICacheKeyMapping';
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
  { label: 'GetFileAsync', kind: 'Method', insertText: 'await GetFileAsync(context.Runtime.Domain, context.Instance.Flow, context.Instance.Id.ToString(), ${1:handle.file})', isSnippet: true, detail: 'ScriptBase → Task<ScriptFile>', documentation: 'Reads a stored x-storage file of an instance (bytes verified against its eTag). Use `OpenRead()` on the result for a stream.' },
  { label: 'PutFileAsync', kind: 'Method', insertText: 'await PutFileAsync(context.Runtime.Domain, context.Instance.Flow, context.Instance.Id.ToString(), "${1:vnext-blob-s3}", ${2:stream}, "${3:name.pdf}", "${4:application/pdf}")', isSnippet: true, detail: 'ScriptBase → Task<ScriptStoredFile>', documentation: 'Runtime 0.0.102: stores `byte[]` or a `Stream` in an x-storage binding and returns the persisted handle (`component`, `file`, `name`, `mimeType`, `size`, `eTag`, `owner`). Put it at an x-storage path of the output to keep it.\n\n```csharp\nvar converted = await PutFileAsync(context.Runtime.Domain, context.Instance.Flow,\n    context.Instance.Id.ToString(), "vnext-blob-s3", output, "converted.pdf", "application/pdf");\n```' },
  { label: 'FileObjectKey', kind: 'Method', insertText: 'FileObjectKey(${1:handle.file})', isSnippet: true, detail: 'ScriptBase → string', documentation: 'Runtime 0.0.102: the store object key of a stored file (`FileStorage:KeyPrefix` + file id) for a DaprBinding task that reads, lists or deletes it.\n\n```csharp\nbindingTask.SetMetadata(new() { ["key"] = FileObjectKey(handle.file) });\n```' },
];

// ScriptFile members (result of GetFileAsync)
const SCRIPT_FILE_MEMBERS: CompletionDef[] = [
  { label: 'OpenRead', kind: 'Method', insertText: 'OpenRead()', detail: 'Stream', documentation: 'Runtime 0.0.102: a new read-only, seekable MemoryStream over the verified bytes on every call.\n\n```csharp\nusing var input = source.OpenRead();\n```' },
];

// DaprBindingTask methods (public since runtime 0.0.102)
const BINDING_TASK_MEMBERS: CompletionDef[] = [
  { label: 'SetOperation', kind: 'Method', insertText: 'SetOperation("${1|create,get,list,delete|}")', isSnippet: true, detail: 'void', documentation: 'Sets the binding operation when the task definition does not fix it.' },
  { label: 'SetData', kind: 'Method', insertText: 'SetData(${1:data})', isSnippet: true, detail: 'void', documentation: 'Sets the binding request data.' },
  { label: 'SetMetadata', kind: 'Method', insertText: 'SetMetadata(new() { ["${1:key}"] = ${2:FileObjectKey(handle.file)} })', isSnippet: true, detail: 'void', documentation: 'Sets the per-call binding metadata, e.g. the object key (`key` for bindings.aws.s3, `fileName` for bindings.localstorage).' },
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

// `context.Caller` (runtime 0.0.105, ICallerAccessor)
const CALLER_PROPERTY: CompletionDef = {
  label: 'Caller',
  kind: 'Property',
  insertText: 'Caller',
  detail: 'ICallerAccessor',
  documentation:
    "Runtime 0.0.105: the caller's role set as the runtime resolved it (the configured caller-role provider). Readable in selection rules (transition `schemas`, function contract slots, state/transition `views`), automatic-transition rules and timer scripts on caller-driven hops, and SubFlow output mappings. Selection by role is not authorization.\n\n```csharp\nawait context.Caller.HasRoleAsync(\"morph-idm.approver\")\n```",
};

const CALLER_MEMBERS: CompletionDef[] = [
  { label: 'HasRoleAsync', kind: 'Method', insertText: 'HasRoleAsync("${1:role}")', isSnippet: true, detail: 'Task<bool>', documentation: 'True when the caller holds `role` (ordinal comparison). Throws `CallerRolesUnavailableException` when there is no caller or the provider could not answer.\n\n```csharp\nreturn await context.Caller.HasRoleAsync("morph-idm.approver");\n```' },
  { label: 'RolesAsync', kind: 'Method', insertText: 'RolesAsync()', detail: 'Task<IReadOnlyList<string>>', documentation: "The caller's roles (empty when they hold none). Throws `CallerRolesUnavailableException` when there is no caller or the provider could not answer." },
  { label: 'IsAvailable', kind: 'Property', insertText: 'IsAvailable', detail: 'bool', documentation: 'False on a surface or hop with no caller (System hops: a fired timer, a SubFlow resume, a continuation). Guard role reads with it in automatic rules, timer scripts and SubFlow output mappings.\n\n```csharp\nvar vip = context.Caller.IsAvailable && await context.Caller.HasRoleAsync("vip");\n```' },
  { label: 'ResolutionFailed', kind: 'Property', insertText: 'ResolutionFailed', detail: 'bool', documentation: 'True once a role read failed because the provider could not answer. The runtime then fails the selection (`503` `Authorization:110006`) whatever the rule returns.' },
  { label: 'RolesFromHeader', kind: 'Property', insertText: 'RolesFromHeader', detail: 'bool?', documentation: "After a read: whether the set came from the request's `role` header rather than the identity provider. Null until roles were read. Diagnostic only; do not branch on it." },
];

/** Monaco markdown for hovering `Caller` or one of its members on `surface`. */
export function callerHoverMarkdown(word: string, surface: ScriptCallerSurface | undefined): string | null {
  const def = word === 'Caller' ? CALLER_PROPERTY : CALLER_MEMBERS.find((m) => m.label === word);
  if (!def) return null;
  const head = word === 'Caller' ? '`ScriptContext.Caller` : `ICallerAccessor`' : `\`ICallerAccessor.${word}\` : \`${def.detail}\``;
  return [head, def.documentation ?? '', callerAvailabilityNote(surface)].filter(Boolean).join('\n\n');
}

function callerAvailabilityNote(surface: ScriptCallerSurface | undefined): string {
  if (!surface) return '';
  const info = SCRIPT_CALLER_SURFACES[surface];
  if (info.availability === 'unavailable') return `**Not available in ${info.label}:** \`IsAvailable\` is false and reads throw.`;
  if (info.availability === 'callerDriven') return `**In ${info.label}:** ${info.whose}. Guard reads with \`IsAvailable\`.`;
  return `**In ${info.label}:** ${info.whose}.`;
}

// Instance members (for dot-trigger after "context.Instance.")
const INSTANCE_MEMBERS: CompletionDef[] = [
  { label: 'Data', kind: 'Property', insertText: 'Data', detail: 'dynamic', documentation: 'Instance data object. All properties are camelCase.\n\n```csharp\nvar userId = context.Instance?.Data?.userId;\n```' },
  { label: 'Id', kind: 'Property', insertText: 'Id', detail: 'Guid', documentation: 'Instance unique identifier.' },
  { label: 'State', kind: 'Property', insertText: 'State', detail: 'string', documentation: 'Current workflow state key.' },
  { label: 'Key', kind: 'Property', insertText: 'Key', detail: 'string', documentation: 'Instance key.' },
  { label: 'Tags', kind: 'Property', insertText: 'Tags', detail: 'string[]', documentation: 'Instance categorization tags.' },
  { label: 'DecryptAsync', kind: 'Method', insertText: 'DecryptAsync("${1:path}")', isSnippet: true, detail: 'Task<string?>', documentation: 'Runtime 0.0.99: decrypts one `x-encryption: encrypt` field of this instance (dotted path). Scripts otherwise see the `ENCRYPTED:` token.\n\n```csharp\nvar iban = await context.Instance.DecryptAsync("customer.iban");\n```' },
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
        const taskTypes = ['HttpTask', 'DaprPubSubTask', 'DaprServiceTask', 'DaprBindingTask', 'GetInstanceDataTask', 'GetInstancesTask', 'DirectTriggerTask', 'SubProcessTask', 'PythonTask'];
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
            label: 'Caller has role',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'context.Caller.IsAvailable && await context.Caller.HasRoleAsync("${1:role}")',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'Caller role check (runtime 0.0.105)',
            documentation: { value: "Selects by the caller's resolved roles. `IsAvailable` keeps the rule safe on hops with no caller.", isTrusted: true },
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
          members = scriptCallerAvailable(callerSurfaceOf(model)) ? [...CONTEXT_MEMBERS, CALLER_PROPERTY] : CONTEXT_MEMBERS;
          break;
        case 'context.Caller':
        case 'caller':
          members = CALLER_MEMBERS;
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
        case 'bindingTask':
        case 'binding':
          members = BINDING_TASK_MEMBERS;
          break;
        case 'source':
        case 'file':
        case 'scriptFile':
          members = SCRIPT_FILE_MEMBERS;
          break;
        default:
          // Try partial matches for common variable names
          if (wordBefore.toLowerCase().includes('binding')) members = BINDING_TASK_MEMBERS;
          else if (wordBefore.toLowerCase().includes('http')) members = HTTP_TASK_MEMBERS;
          else if (wordBefore.toLowerCase().includes('pubsub')) members = PUBSUB_TASK_MEMBERS;
          else if (wordBefore.toLowerCase().includes('service') && wordBefore.toLowerCase().includes('task')) members = SERVICE_TASK_MEMBERS;
          break;
      }

      return { suggestions: buildSuggestions(members, range, monaco) };
    },
  });

  // Hover for `context.Caller` members (static; the LSP adds its own when connected).
  monaco.languages.registerHoverProvider('csharp', {
    provideHover: (model: any, position: any) => {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      const before = model.getLineContent(position.lineNumber).substring(0, word.startColumn - 1);
      const isCaller = word.word === 'Caller' && /\.\s*$/.test(before);
      const isMember = /\bCaller\s*\.\s*$/.test(before) || /\bcaller\s*\.\s*$/.test(before);
      if (!isCaller && !isMember) return null;
      const value = callerHoverMarkdown(word.word, callerSurfaceOf(model));
      if (!value) return null;
      return {
        range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
        contents: [{ value }],
      };
    },
  });
}
