import { z } from 'zod'

const headersSchema = z.record(z.string(), z.string()).optional()
const functionScopeSchema = z.enum(['D', 'F', 'I'])

/**
 * Every method returns the raw exchange instead of throwing on non-2xx.
 * A function under development legitimately answers 4xx/5xx, and the runner
 * must show that plainly rather than as a generic "runtime error".
 */
export const functionExchangeResult = z.object({
  status: z.number().int(),
  contentType: z.string(),
  responseHeaders: z.record(z.string(), z.string()).default({}),
  body: z.string(),
  /**
   * Parsed body when the content type is JSON and parsing succeeded.
   *
   * A legitimate JSON body can decode to `null`, `0`, `false`, or `''` — all
   * falsy. Consumers must check `'json' in exchange` to know whether parsing
   * happened, never this field's truthiness.
   */
  json: z.unknown().optional(),
  /**
   * Populated when the content type said JSON but `JSON.parse` failed. This
   * is recorded, not merely tolerated: a malformed JSON body from a function
   * under development is exactly the case this service exists to surface,
   * not paper over. `body` still carries the raw text either way.
   */
  jsonParseError: z.string().optional(),
})

export const functionsGetInfoParams = z.object({
  domain: z.string().min(1),
  functionKey: z.string().min(1),
  scope: functionScopeSchema,
  workflowKey: z.string().optional(),
  instanceId: z.string().optional(),
  headers: headersSchema,
  runtimeUrl: z.string().optional(),
})
export const functionsGetInfoResult = functionExchangeResult

export const functionsFetchContractParams = z.object({
  /** An href taken from the `/info` payload. */
  path: z.string().min(1),
  headers: headersSchema,
  runtimeUrl: z.string().optional(),
})
export const functionsFetchContractResult = functionExchangeResult

export const functionsInvokeParams = z.object({
  path: z.string().min(1),
  verb: z.enum(['GET', 'POST', 'PATCH', 'DELETE']),
  body: z.string().optional(),
  contentType: z.string().optional(),
  query: z.record(z.string(), z.string()).optional(),
  headers: headersSchema,
  runtimeUrl: z.string().optional(),
})
export const functionsInvokeResult = functionExchangeResult
