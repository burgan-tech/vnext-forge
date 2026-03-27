import type { CsxTaskType } from './csx-context';

/* ────────────── Types ────────────── */

export type TemplateType = 'mapping' | 'condition' | 'timer';

interface GeneratedTemplate {
  code: string;
  usings: string[];
}

/* ────────────── Helpers ────────────── */

function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

const TEMPLATE_SUFFIX: Record<TemplateType, string> = {
  mapping: 'Mapping',
  condition: 'Rule',
  timer: 'Timer',
};

/* ────────────── Using Blocks ────────────── */

const BASE_USINGS = ['System', 'System.Threading.Tasks'];

const MAPPING_USINGS = [...BASE_USINGS, 'System.Collections.Generic', 'System.Linq'];

const TIMER_USINGS = [...BASE_USINGS];

/* ────────────── Task-Specific InputHandler Bodies ────────────── */

const INPUT_HANDLER_BODIES: Record<CsxTaskType, string> = {
  HttpTask: `        var httpTask = task as HttpTask;
        if (httpTask == null)
        {
            LogError("{ClassName}: Task must be an HttpTask");
            return new ScriptResponse();
        }

        // Configure URL — resolve from config if needed
        // var baseUrl = GetConfigValue("YourDomain:ServiceName:BaseUrl");
        // httpTask.SetUrl($"{baseUrl}/api/endpoint");

        // Set request body from instance data
        httpTask.SetBody(new
        {
            // property = context.Instance?.Data?.propertyName
        });

        // Set headers
        httpTask.SetHeaders(new Dictionary<string, string?>
        {
            ["Content-Type"] = "application/json"
            // ["Authorization"] = $"Bearer {token}"
        });

        return new ScriptResponse();`,

  DaprPubSubTask: `        var pubsubTask = task as DaprPubSubTask;
        if (pubsubTask == null)
        {
            LogError("{ClassName}: Task must be a DaprPubSubTask");
            return new ScriptResponse();
        }

        pubsubTask.SetPubSubName("vnext-execution-pubsub");
        pubsubTask.SetTopic("domain.event-name");
        pubsubTask.SetData(new
        {
            eventType = "EventName",
            instanceId = context.Instance?.Id?.ToString(),
            timestamp = DateTime.UtcNow
            // Add event data from instance
        });

        return new ScriptResponse();`,

  DaprServiceTask: `        var serviceTask = task as DaprServiceTask;
        if (serviceTask == null)
        {
            LogError("{ClassName}: Task must be a DaprServiceTask");
            return new ScriptResponse();
        }

        serviceTask.SetAppId("target-app-id");
        serviceTask.SetMethodName("api/method");
        serviceTask.SetData(new
        {
            // key = context.Instance?.Data?.propertyName
        });

        return new ScriptResponse();`,

  DaprBindingTask: `        var bindingTask = task as DaprBindingTask;
        if (bindingTask == null)
        {
            LogError("{ClassName}: Task must be a DaprBindingTask");
            return new ScriptResponse();
        }

        // Configure binding operation
        // bindingTask.SetOperation("create");
        // bindingTask.SetData(new { ... });

        return new ScriptResponse();`,

  ScriptTask: `        // ScriptTask — business logic only, no remote calls
        // Use for calculations, data transformation, validation

        var data = context.Instance?.Data;

        // Perform your logic here

        return new ScriptResponse();`,

  GetInstanceDataTask: `        var instanceTask = task as GetInstanceDataTask;
        if (instanceTask == null)
        {
            LogError("{ClassName}: Task must be a GetInstanceDataTask");
            return new ScriptResponse();
        }

        // Set the instance key to fetch
        var targetKey = context.Instance?.Data?.targetKey?.ToString();
        if (!string.IsNullOrEmpty(targetKey))
        {
            instanceTask.SetKey(targetKey);
        }

        // instanceTask.SetDomain("domain-name");
        // instanceTask.SetFlow("flow-name");

        return new ScriptResponse();`,

  GetInstancesTask: `        var instancesTask = task as GetInstancesTask;
        if (instancesTask == null)
        {
            LogError("{ClassName}: Task must be a GetInstancesTask");
            return new ScriptResponse();
        }

        instancesTask.SetDomain("domain-name");
        instancesTask.SetFlow("flow-name");

        // Build filter
        // var filter = new { field = "propertyName", op = "eq", value = "targetValue" };
        // instancesTask.SetFilter(new[] { filter });

        return new ScriptResponse();`,

  DirectTriggerTask: `        var triggerTask = task as DirectTriggerTask;
        if (triggerTask == null)
        {
            LogError("{ClassName}: Task must be a DirectTriggerTask");
            return new ScriptResponse();
        }

        // Set target instance and trigger data
        // var instanceId = context.Instance?.Data?.targetInstanceId?.ToString();
        // triggerTask.SetInstance(instanceId);
        // triggerTask.SetBody(new { ... });

        return new ScriptResponse();`,

  SubProcessTask: `        var subTask = task as SubProcessTask;
        if (subTask == null)
        {
            LogError("{ClassName}: Task must be a SubProcessTask");
            return new ScriptResponse();
        }

        // Configure subprocess
        // subTask.SetDomain("domain");
        // subTask.SetFlow("flow-name");
        // subTask.SetData(new { ... });

        return new ScriptResponse();`,

  StartTask: `        // StartTask — typically no configuration needed
        // The start task initializes the workflow instance

        return new ScriptResponse();`,
};

/* ────────────── OutputHandler Bodies ────────────── */

const OUTPUT_HANDLER_BODIES: Record<string, string> = {
  HttpTask: `        // Parse response from HTTP call
        var statusCode = (int)(context.Body?.statusCode ?? 200);
        var responseData = context.Body?.data ?? context.Body;

        if (statusCode >= 200 && statusCode < 300)
        {
            LogInformation("{ClassName}: Success — statusCode={0}", args: new object?[] { statusCode });
            return new ScriptResponse
            {
                Data = new
                {
                    // Map response data to instance properties
                    // result = responseData?.fieldName
                }
            };
        }
        else
        {
            var errorMessage = responseData?.message?.ToString() ?? responseData?.error?.ToString() ?? "Unknown error";
            LogWarning("{ClassName}: Failed — statusCode={0}, error={1}", args: new object?[] { statusCode, errorMessage });
            return new ScriptResponse
            {
                Data = new
                {
                    errorCode = statusCode.ToString(),
                    errorMessage = errorMessage
                }
            };
        }`,

  DaprPubSubTask: `        // PubSub typically doesn't return meaningful data
        LogInformation("{ClassName}: Event published successfully");
        return new ScriptResponse();`,

  DaprServiceTask: `        // Parse response from Dapr service call
        var responseData = context.Body?.data ?? context.Body;
        var isSuccess = context.Body?.isSuccess ?? true;

        if ((bool)isSuccess)
        {
            return new ScriptResponse
            {
                Data = new
                {
                    // result = responseData?.fieldName
                }
            };
        }
        else
        {
            LogWarning("{ClassName}: Service call failed");
            return new ScriptResponse();
        }`,

  GetInstanceDataTask: `        // Parse fetched instance data
        var fetchedData = context.Body?.data?.data ?? context.Body?.data;

        if (fetchedData != null)
        {
            LogInformation("{ClassName}: Instance data fetched successfully");
            return new ScriptResponse
            {
                Data = new
                {
                    // snapshot = fetchedData
                    // Or extract specific fields:
                    // fieldName = fetchedData?.fieldName
                }
            };
        }
        else
        {
            LogWarning("{ClassName}: No instance data returned");
            return new ScriptResponse();
        }`,

  GetInstancesTask: `        // Parse fetched instances list
        var instances = context.Body?.data ?? context.Body;

        LogInformation("{ClassName}: Instances query completed");
        return new ScriptResponse
        {
            Data = new
            {
                // queryResult = instances
            }
        };`,

  default: `        // Process task response
        return new ScriptResponse
        {
            Data = new
            {
                // Map output data here
            }
        };`,
};

/* ────────────── Condition/Rule Template ────────────── */

function generateConditionTemplate(className: string): GeneratedTemplate {
  return {
    usings: BASE_USINGS,
    code: `public class ${className} : ScriptBase, IConditionMapping
{
    public async Task<bool> Handler(ScriptContext context)
    {
        try
        {
            var data = context.Instance?.Data;

            // Check if required property exists
            // if (!HasProperty(data, "propertyName"))
            // {
            //     LogWarning("${className}: Property 'propertyName' not found");
            //     return false;
            // }

            // Evaluate condition
            // var value = data?.propertyName?.ToString();
            // var result = !string.IsNullOrEmpty(value);

            // LogInformation("${className}: result={0}", args: new object?[] { result });
            // return result;

            return false;
        }
        catch (Exception ex)
        {
            LogError("${className}: Error — {0}", args: new object?[] { ex.Message });
            return false;
        }
    }
}`,
  };
}

/* ────────────── Timer Template ────────────── */

function generateTimerTemplate(className: string): GeneratedTemplate {
  return {
    usings: TIMER_USINGS,
    code: `public class ${className} : ITimerMapping
{
    public async Task<TimerSchedule> Handler(ScriptContext context)
    {
        // Option 1: Fixed duration
        return TimerSchedule.FromDuration(TimeSpan.FromMinutes(5));

        // Option 2: Absolute date/time
        // return TimerSchedule.FromDateTime(DateTime.UtcNow.AddHours(1));

        // Option 3: Cron expression (e.g., every day at 9:00 AM)
        // return TimerSchedule.FromCronExpression("0 9 * * *");

        // Option 4: Immediate execution
        // return TimerSchedule.Immediate();

        // Option 5: Dynamic from instance data
        // var minutes = Convert.ToInt32(context.Instance?.Data?.delayMinutes ?? 5);
        // return TimerSchedule.FromDuration(TimeSpan.FromMinutes(minutes));
    }
}`,
  };
}

/* ────────────── Mapping Template ────────────── */

function generateMappingTemplate(className: string, taskType?: CsxTaskType): GeneratedTemplate {
  const inputBody = taskType
    ? (INPUT_HANDLER_BODIES[taskType] ?? INPUT_HANDLER_BODIES.ScriptTask)
    : `        // Configure task input here
        return new ScriptResponse();`;

  const outputBody = taskType
    ? (OUTPUT_HANDLER_BODIES[taskType] ?? OUTPUT_HANDLER_BODIES.default)
    : OUTPUT_HANDLER_BODIES.default;

  // Replace {ClassName} placeholder
  const resolvedInput = inputBody.replace(/\{ClassName\}/g, className);
  const resolvedOutput = outputBody.replace(/\{ClassName\}/g, className);

  return {
    usings: MAPPING_USINGS,
    code: `public class ${className} : ScriptBase, IMapping
{
    public async Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)
    {
${resolvedInput}
    }

    public async Task<ScriptResponse> OutputHandler(ScriptContext context)
    {
${resolvedOutput}
    }
}`,
  };
}

/* ────────────── Main Generator ────────────── */

export function generateTemplate(
  templateType: TemplateType,
  contextName?: string,
  taskType?: CsxTaskType,
): { location: string; code: string } {
  const suffix = TEMPLATE_SUFFIX[templateType];
  const className = contextName ? toPascalCase(contextName) + suffix : `New${suffix}`;
  const location = `./src/${className}.csx`;

  let template: GeneratedTemplate;
  switch (templateType) {
    case 'mapping':
      template = generateMappingTemplate(className, taskType);
      break;
    case 'condition':
      template = generateConditionTemplate(className);
      break;
    case 'timer':
      template = generateTimerTemplate(className);
      break;
  }

  const usingsBlock = template.usings.map((u) => `using ${u};`).join('\n');
  const fullCode = `${usingsBlock}\n\n${template.code}`;

  return { location, code: fullCode };
}

export { toPascalCase, TEMPLATE_SUFFIX };
