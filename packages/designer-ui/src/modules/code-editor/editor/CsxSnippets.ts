import type { TemplateType } from './CsxTemplates';

/* ────────────── Snippet Types ────────────── */

export interface CsxSnippet {
  id: string;
  label: string;
  /** Short label for toolbar button */
  shortLabel: string;
  description: string;
  /** Monaco snippet syntax with $1, $2 placeholders */
  code: string;
  /** Which template types this snippet applies to */
  applicableTo: TemplateType[];
  category: 'task-setup' | 'response' | 'error' | 'config' | 'data' | 'logging';
}

/* ────────────── Snippet Catalog ────────────── */

export const CSX_SNIPPETS: CsxSnippet[] = [
  {
    id: 'http-setup',
    label: 'HTTP Task Setup',
    shortLabel: 'HTTP',
    description: 'Cast to HttpTask with URL, headers, and body configuration',
    applicableTo: ['mapping'],
    category: 'task-setup',
    code: `var httpTask = task as HttpTask;
if (httpTask == null)
{
    LogError("\${1:ClassName}: Task must be an HttpTask");
    return new ScriptResponse();
}

var baseUrl = GetConfigValue("\${2:Domain:Service:BaseUrl}");
httpTask.SetUrl($"{baseUrl}/\${3:api/endpoint}");
httpTask.SetBody(new
{
    \${4:property} = context.Instance?.Data?.\${5:fieldName}
});
httpTask.SetHeaders(new Dictionary<string, string?>
{
    ["Content-Type"] = "application/json"\${0}
});`,
  },
  {
    id: 'response-parse',
    label: 'Response Parse',
    shortLabel: 'Response',
    description: 'Parse HTTP response with status check and data extraction',
    applicableTo: ['mapping'],
    category: 'response',
    code: `var statusCode = (int)(context.Body?.statusCode ?? 200);
var responseData = context.Body?.data ?? context.Body;

if (statusCode >= 200 && statusCode < 300)
{
    LogInformation("\${1:ClassName}: Success — statusCode={0}", args: new object?[] { statusCode });
    return new ScriptResponse
    {
        Data = new
        {
            \${2:result} = responseData?.\${3:fieldName}\${0}
        }
    };
}
else
{
    var errorMessage = responseData?.message?.ToString() ?? "Unknown error";
    LogWarning("\${1}: Failed — statusCode={0}, error={1}", args: new object?[] { statusCode, errorMessage });
    return new ScriptResponse
    {
        Data = new { errorCode = statusCode.ToString(), errorMessage }
    };
}`,
  },
  {
    id: 'error-handle',
    label: 'Error Handling',
    shortLabel: 'Try/Catch',
    description: 'Try/catch block with logging and safe return',
    applicableTo: ['mapping', 'condition', 'timer'],
    category: 'error',
    code: `try
{
    \${0}
}
catch (Exception ex)
{
    LogError("\${1:ClassName}: \${2:handler} error — {0}", args: new object?[] { ex.Message });
    return \${3:new ScriptResponse()};
}`,
  },
  {
    id: 'config-access',
    label: 'Config / Secret Access',
    shortLabel: 'Config',
    description: 'Get configuration value with secret fallback',
    applicableTo: ['mapping', 'condition'],
    category: 'config',
    code: `var \${1:value} = GetConfigValue("\${2:Domain:Service:Setting}");
if (string.IsNullOrEmpty(\${1}))
{
    \${1} = await GetSecretAsync("\${3:vnext-secret}", "\${4:workflow-secret}", "\${2}");
}\${0}`,
  },
  {
    id: 'safe-property',
    label: 'Safe Property Access',
    shortLabel: 'HasProp',
    description: 'Check property existence before accessing dynamic data',
    applicableTo: ['mapping', 'condition', 'timer'],
    category: 'data',
    code: `if (HasProperty(context.Instance?.Data, "\${1:propertyName}"))
{
    var \${2:value} = context.Instance.Data.\${1}?.ToString();
    \${0}
}`,
  },
  {
    id: 'array-mutate',
    label: 'Array Mutation',
    shortLabel: 'Array',
    description: 'Safely convert and modify dynamic arrays',
    applicableTo: ['mapping'],
    category: 'data',
    code: `var \${1:items} = new List<dynamic>();
if (HasProperty(context.Instance?.Data, "\${2:listProperty}"))
{
    \${1} = ((IEnumerable<dynamic>)context.Instance.Data.\${2}).ToList();
}
\${1}.Add(new
{
    \${3:property} = \${4:value},
    timestamp = DateTime.UtcNow
});

return new ScriptResponse
{
    Data = new { \${2} = \${1} }
};\${0}`,
  },
  {
    id: 'log-pattern',
    label: 'Log Pattern',
    shortLabel: 'Log',
    description: 'Formatted logging with arguments',
    applicableTo: ['mapping', 'condition', 'timer'],
    category: 'logging',
    code: `LogInformation("\${1:ClassName}: \${2:message} — {0}", args: new object?[] { \${3:value} });\${0}`,
  },
  {
    id: 'pubsub-event',
    label: 'PubSub Event',
    shortLabel: 'PubSub',
    description: 'Cast to DaprPubSubTask with topic and data',
    applicableTo: ['mapping'],
    category: 'task-setup',
    code: `var pubsubTask = task as DaprPubSubTask;
if (pubsubTask == null)
{
    LogError("\${1:ClassName}: Task must be a DaprPubSubTask");
    return new ScriptResponse();
}

pubsubTask.SetPubSubName("\${2:vnext-execution-pubsub}");
pubsubTask.SetTopic("\${3:domain.event-name}");
pubsubTask.SetData(new
{
    eventType = "\${4:EventName}",
    instanceId = context.Instance?.Id?.ToString(),
    timestamp = DateTime.UtcNow\${0}
});`,
  },
  {
    id: 'dapr-service',
    label: 'Dapr Service Call',
    shortLabel: 'Service',
    description: 'Cast to DaprServiceTask with app ID and method',
    applicableTo: ['mapping'],
    category: 'task-setup',
    code: `var serviceTask = task as DaprServiceTask;
if (serviceTask == null)
{
    LogError("\${1:ClassName}: Task must be a DaprServiceTask");
    return new ScriptResponse();
}

serviceTask.SetAppId("\${2:target-app-id}");
serviceTask.SetMethodName("\${3:api/method}");
serviceTask.SetData(new
{
    \${4:key} = \${5:context.Instance?.Data?.fieldName}\${0}
});`,
  },
  {
    id: 'ok-fail',
    label: 'ScriptResponse Return',
    shortLabel: 'Return',
    description: 'ScriptResponse with Data payload',
    applicableTo: ['mapping', 'condition', 'timer'],
    category: 'response',
    code: `return new ScriptResponse
{
    Data = new
    {
        \${1:property} = \${2:value}\${0}
    }
};`,
  },
  {
    id: 'get-instance',
    label: 'Get Instance Data',
    shortLabel: 'GetInst',
    description: 'Cast to GetInstanceDataTask and fetch data',
    applicableTo: ['mapping'],
    category: 'task-setup',
    code: `var instanceTask = task as GetInstanceDataTask;
if (instanceTask == null)
{
    LogError("\${1:ClassName}: Task must be a GetInstanceDataTask");
    return new ScriptResponse();
}

var targetKey = context.Instance?.Data?.\${2:targetKey}?.ToString();
if (!string.IsNullOrEmpty(targetKey))
{
    instanceTask.SetKey(targetKey);
}
// instanceTask.SetDomain("\${3:domain}");
// instanceTask.SetFlow("\${4:flow}");\${0}`,
  },
];

/* ────────────── Helpers ────────────── */

export function getSnippetsForType(templateType: TemplateType): CsxSnippet[] {
  return CSX_SNIPPETS.filter((s) => s.applicableTo.includes(templateType));
}
