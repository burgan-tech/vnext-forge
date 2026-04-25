/* ────────────── CSX API Reference Data ────────────── */

export interface ApiEntry {
  name: string;
  signature: string;
  returnType: string;
  description: string;
  insertText?: string;
}

export interface ApiSection {
  title: string;
  entries: ApiEntry[];
}

/* ────────────── Reference Data ────────────── */

export const CSX_API_REFERENCE: ApiSection[] = [
  {
    title: 'ScriptBase — Logging',
    entries: [
      { name: 'LogInformation', signature: '(string message, params object?[] args)', returnType: 'void', description: 'Logs an informational message with optional format arguments.', insertText: 'LogInformation("$1", args: new object?[] { $2 });' },
      { name: 'LogWarning', signature: '(string message, params object?[] args)', returnType: 'void', description: 'Logs a warning message.', insertText: 'LogWarning("$1", args: new object?[] { $2 });' },
      { name: 'LogError', signature: '(string message, params object?[] args)', returnType: 'void', description: 'Logs an error message.', insertText: 'LogError("$1", args: new object?[] { $2 });' },
      { name: 'LogDebug', signature: '(string message, params object?[] args)', returnType: 'void', description: 'Logs a debug-level message.', insertText: 'LogDebug("$1");' },
      { name: 'LogTrace', signature: '(string message, params object?[] args)', returnType: 'void', description: 'Logs a trace-level message.', insertText: 'LogTrace("$1");' },
      { name: 'LogCritical', signature: '(string message, params object?[] args)', returnType: 'void', description: 'Logs a critical error message.', insertText: 'LogCritical("$1");' },
    ],
  },
  {
    title: 'ScriptBase — Property Access',
    entries: [
      { name: 'HasProperty', signature: '(dynamic obj, string propertyName)', returnType: 'bool', description: 'Checks if a dynamic object has the specified property.', insertText: 'HasProperty($1, "$2")' },
      { name: 'GetPropertyValue', signature: '(object obj, string propertyName)', returnType: 'object?', description: 'Gets a property value safely from a dynamic object.', insertText: 'GetPropertyValue($1, "$2")' },
      { name: 'GetPropertyValue<T>', signature: '(object obj, string propertyName)', returnType: 'T?', description: 'Gets a typed property value safely.', insertText: 'GetPropertyValue<$1>($2, "$3")' },
    ],
  },
  {
    title: 'ScriptBase — Configuration',
    entries: [
      { name: 'GetConfigValue', signature: '(string key)', returnType: 'string?', description: 'Gets a configuration value by key (e.g., "Domain:Service:Setting").', insertText: 'GetConfigValue("$1")' },
      { name: 'GetConfigValue<T>', signature: '(string key)', returnType: 'T?', description: 'Gets a typed configuration value.', insertText: 'GetConfigValue<$1>("$2")' },
      { name: 'ConfigExists', signature: '(string key)', returnType: 'bool', description: 'Checks if a configuration key exists.', insertText: 'ConfigExists("$1")' },
      { name: 'GetConnectionString', signature: '(string name)', returnType: 'string?', description: 'Gets a database connection string by name.', insertText: 'GetConnectionString("$1")' },
      { name: 'GetSecret', signature: '(string storeName, string secretStore, string secretKey)', returnType: 'string', description: 'Gets a secret value synchronously.', insertText: 'GetSecret("$1", "$2", "$3")' },
      { name: 'GetSecretAsync', signature: '(string storeName, string secretStore, string secretKey)', returnType: 'Task<string>', description: 'Gets a secret value asynchronously.', insertText: 'await GetSecretAsync("$1", "$2", "$3")' },
    ],
  },
  {
    title: 'ScriptContext',
    entries: [
      { name: 'Body', signature: '', returnType: 'dynamic', description: 'Request payload data (camelCase, null-safe with ?.).', insertText: 'context.Body' },
      { name: 'Headers', signature: '', returnType: 'dynamic', description: 'Request headers (all keys lowercase).', insertText: 'context.Headers' },
      { name: 'Instance', signature: '', returnType: 'Instance', description: 'Active workflow instance — .Data, .Id, .State, .Key, .Tags', insertText: 'context.Instance' },
      { name: 'Instance.Data', signature: '', returnType: 'dynamic', description: 'Instance data object. All properties camelCase.', insertText: 'context.Instance?.Data' },
      { name: 'TaskResponse', signature: '', returnType: 'Dictionary<string, dynamic?>', description: 'Results from completed tasks in current state.', insertText: 'context.TaskResponse' },
      { name: 'Transition', signature: '', returnType: 'Transition', description: 'Current state change information.', insertText: 'context.Transition' },
      { name: 'Workflow', signature: '', returnType: 'Workflow', description: 'Workflow blueprint and structure definition.', insertText: 'context.Workflow' },
      { name: 'Runtime', signature: '', returnType: 'IRuntimeInfoProvider', description: 'Runtime environment and services.', insertText: 'context.Runtime' },
      { name: 'MetaData', signature: '', returnType: 'Dictionary<string, dynamic>', description: 'Execution metadata and performance metrics.', insertText: 'context.MetaData' },
      { name: 'QueryParameters', signature: '', returnType: 'dynamic', description: 'Query string parameters (Function tasks only).', insertText: 'context.QueryParameters' },
      { name: 'RouteValues', signature: '', returnType: 'dynamic', description: 'URL path and query parameters.', insertText: 'context.RouteValues' },
    ],
  },
  {
    title: 'ScriptResponse',
    entries: [
      { name: 'Data', signature: '', returnType: 'dynamic?', description: 'Primary data payload — merged into instance data.', insertText: 'Data = new { $1 }' },
      { name: 'Key', signature: '', returnType: 'string?', description: 'Unique identifier/key.', insertText: 'Key = "$1"' },
      { name: 'Headers', signature: '', returnType: 'dynamic?', description: 'HTTP/metadata headers.', insertText: 'Headers = new { $1 }' },
      { name: 'RouteValues', signature: '', returnType: 'dynamic?', description: 'Routing parameters.', insertText: 'RouteValues = new { $1 }' },
      { name: 'Tags', signature: '', returnType: 'string[]', description: 'Categorization tags.', insertText: 'Tags = new[] { "$1" }' },
    ],
  },
  {
    title: 'HttpTask',
    entries: [
      { name: 'SetUrl', signature: '(string url)', returnType: 'void', description: 'Sets the HTTP request URL.', insertText: 'httpTask.SetUrl($1);' },
      { name: 'SetBody', signature: '(dynamic body)', returnType: 'void', description: 'Sets the HTTP request body.', insertText: 'httpTask.SetBody(new { $1 });' },
      { name: 'SetHeaders', signature: '(Dictionary<string, string?> headers)', returnType: 'void', description: 'Sets HTTP request headers.', insertText: 'httpTask.SetHeaders(new Dictionary<string, string?>\n{\n    $1\n});' },
      { name: 'Method', signature: '', returnType: 'string', description: 'HTTP method (GET/POST/PUT/DELETE/PATCH).', insertText: 'httpTask.Method = "$1";' },
    ],
  },
  {
    title: 'DaprPubSubTask',
    entries: [
      { name: 'SetPubSubName', signature: '(string pubSubName)', returnType: 'void', description: 'Sets the pub/sub component name.', insertText: 'pubsubTask.SetPubSubName("$1");' },
      { name: 'SetTopic', signature: '(string topic)', returnType: 'void', description: 'Sets the topic to publish to.', insertText: 'pubsubTask.SetTopic("$1");' },
      { name: 'SetData', signature: '(dynamic data)', returnType: 'void', description: 'Sets the event data payload.', insertText: 'pubsubTask.SetData(new { $1 });' },
      { name: 'SetMetadata', signature: '(Dictionary<string, string?> metadata)', returnType: 'void', description: 'Sets additional metadata for the message.', insertText: 'pubsubTask.SetMetadata(new Dictionary<string, string?> { $1 });' },
    ],
  },
  {
    title: 'DaprServiceTask',
    entries: [
      { name: 'SetAppId', signature: '(string appId)', returnType: 'void', description: 'Sets the target Dapr application ID.', insertText: 'serviceTask.SetAppId("$1");' },
      { name: 'SetMethodName', signature: '(string methodName)', returnType: 'void', description: 'Sets the method/endpoint to invoke.', insertText: 'serviceTask.SetMethodName("$1");' },
      { name: 'SetQueryString', signature: '(string? queryString)', returnType: 'void', description: 'Sets query string parameters.', insertText: 'serviceTask.SetQueryString("$1");' },
      { name: 'SetData', signature: '(dynamic data)', returnType: 'void', description: 'Sets the request data payload.', insertText: 'serviceTask.SetData(new { $1 });' },
    ],
  },
  {
    title: 'Other Task Types',
    entries: [
      { name: 'GetInstanceDataTask.SetKey', signature: '(string key)', returnType: 'void', description: 'Sets the instance key to fetch.', insertText: 'instanceTask.SetKey($1);' },
      { name: 'GetInstancesTask.SetDomain', signature: '(string domain)', returnType: 'void', description: 'Sets the domain to query.', insertText: 'instancesTask.SetDomain("$1");' },
      { name: 'GetInstancesTask.SetFlow', signature: '(string flow)', returnType: 'void', description: 'Sets the flow to query.', insertText: 'instancesTask.SetFlow("$1");' },
      { name: 'GetInstancesTask.SetFilter', signature: '(object[] filter)', returnType: 'void', description: 'Sets query filter criteria.', insertText: 'instancesTask.SetFilter(new[] { $1 });' },
      { name: 'DirectTriggerTask.SetInstance', signature: '(string instanceId)', returnType: 'void', description: 'Sets the target instance to trigger.', insertText: 'triggerTask.SetInstance($1);' },
      { name: 'DirectTriggerTask.SetBody', signature: '(dynamic body)', returnType: 'void', description: 'Sets the trigger request body.', insertText: 'triggerTask.SetBody(new { $1 });' },
    ],
  },
  {
    title: 'TimerSchedule',
    entries: [
      { name: 'FromDuration', signature: '(TimeSpan duration)', returnType: 'TimerSchedule', description: 'Creates a relative delay timer.', insertText: 'TimerSchedule.FromDuration(TimeSpan.FromMinutes($1))' },
      { name: 'FromDateTime', signature: '(DateTime dateTime)', returnType: 'TimerSchedule', description: 'Creates an absolute date/time timer.', insertText: 'TimerSchedule.FromDateTime($1)' },
      { name: 'FromCronExpression', signature: '(string cronExpression)', returnType: 'TimerSchedule', description: 'Creates a cron-based recurring timer.', insertText: 'TimerSchedule.FromCronExpression("$1")' },
      { name: 'Immediate', signature: '()', returnType: 'TimerSchedule', description: 'Creates an immediate execution timer.', insertText: 'TimerSchedule.Immediate()' },
    ],
  },
];

/** CsxReferencePanel arama kutusu — ad veya açıklamada alt dizgi eşleşmesi */
export function filterCsxApiReferenceSections(
  search: string,
  sections: ApiSection[] = CSX_API_REFERENCE,
): ApiSection[] {
  const q = search.trim().toLowerCase();
  if (!q) return sections;
  return sections
    .map((section) => ({
      ...section,
      entries: section.entries.filter(
        (entry) =>
          entry.name.toLowerCase().includes(q) || entry.description.toLowerCase().includes(q),
      ),
    }))
    .filter((section) => section.entries.length > 0);
}
