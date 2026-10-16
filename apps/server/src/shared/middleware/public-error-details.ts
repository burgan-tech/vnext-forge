import {
  ERROR_CODES,
  type ErrorCode,
  type VnextForgeError,
} from '@vnext-forge-studio/app-contracts'

/**
 * The public `error.details` of a failure envelope (ADR 005, addendum
 * "Runtime error details"). `VnextForgeError.context.details` is server-side
 * data and stays in the logs, with one exception: a non-2xx answer of the
 * vNext runtime. `QuickRunService` turns that answer into `RUNTIME_NOT_FOUND`
 * / `RUNTIME_EXECUTION_FAILED` with `details = { httpStatus, ...runtimeBody }`,
 * and the QuickRun error banner needs the runtime's code, message and
 * validation lines from it.
 *
 * Only that shape is forwarded, and only through a key whitelist: the HTTP
 * status, the scalar fields of the runtime body (top level and the Aether
 * `error` envelope) and its `errors` / `validationErrors` lists. Forge-internal
 * keys (`runtimeUrl`, `fullUrl`, `rawData`, stack-like fields of the runtime
 * body, …) never reach the client. Strings and lists are capped.
 */

const PUBLIC_DETAIL_CODES: ReadonlySet<ErrorCode> = new Set([
  ERROR_CODES.RUNTIME_NOT_FOUND,
  ERROR_CODES.RUNTIME_EXECUTION_FAILED,
])

const STRING_KEYS = ['prefix', 'code', 'errorCode', 'type', 'message', 'detail', 'title', 'target', 'traceId'] as const
const ITEM_STRING_KEYS = ['code', 'errorCode', 'target', 'message', 'errorMessage', 'detail', 'description'] as const

const MAX_STRING = 1000
const MAX_ITEMS = 50

function rec(v: unknown): Record<string, unknown> | undefined {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined
}

function cap(v: unknown): string | undefined {
  return typeof v === 'string' ? v.slice(0, MAX_STRING) : undefined
}

function pickStrings(source: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of keys) {
    const value = cap(source[key])
    if (value !== undefined) out[key] = value
  }
  return out
}

function stringList(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  return v.slice(0, MAX_ITEMS).flatMap((m) => (typeof m === 'string' ? [m.slice(0, MAX_STRING)] : []))
}

function projectValidationErrors(v: unknown): Record<string, unknown>[] | undefined {
  if (!Array.isArray(v)) return undefined
  return v.slice(0, MAX_ITEMS).flatMap((item) => {
    const r = rec(item)
    if (!r) return []
    const out = pickStrings(r, ['message', 'errorMessage'])
    const members = stringList(r.members)
    const memberNames = stringList(r.memberNames)
    if (members) out.members = members
    if (memberNames) out.memberNames = memberNames
    return [out]
  })
}

function projectErrors(v: unknown): unknown {
  if (Array.isArray(v)) {
    return v.slice(0, MAX_ITEMS).flatMap((item): unknown[] => {
      if (typeof item === 'string') return [item.slice(0, MAX_STRING)]
      const r = rec(item)
      return r ? [pickStrings(r, ITEM_STRING_KEYS)] : []
    })
  }
  const dict = rec(v)
  if (!dict) return undefined
  const out: Record<string, unknown> = {}
  for (const [field, messages] of Object.entries(dict).slice(0, MAX_ITEMS)) {
    const key = field.slice(0, MAX_STRING)
    const list = stringList(messages)
    if (list) out[key] = list
    else if (typeof messages === 'string') out[key] = messages.slice(0, MAX_STRING)
  }
  return out
}

function projectBody(body: Record<string, unknown>): Record<string, unknown> {
  const out = pickStrings(body, STRING_KEYS)
  if (typeof body.status === 'number') out.status = body.status
  const validationErrors = projectValidationErrors(body.validationErrors)
  if (validationErrors) out.validationErrors = validationErrors
  const errors = projectErrors(body.errors)
  if (errors !== undefined) out.errors = errors
  return out
}

export function publicErrorDetails(error: VnextForgeError): Record<string, unknown> | undefined {
  if (!PUBLIC_DETAIL_CODES.has(error.code)) return undefined
  const details = error.context.details
  if (!details || typeof details.httpStatus !== 'number') return undefined

  const out: Record<string, unknown> = { httpStatus: details.httpStatus, ...projectBody(details) }
  const envelope = rec(details.error)
  if (envelope) out.error = projectBody(envelope)
  return out
}
