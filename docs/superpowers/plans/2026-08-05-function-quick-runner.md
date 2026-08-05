# Function Quick Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a developer invoke a vNext function from inside Forge — pick a verb, fill its input view or a raw payload, send it, and read the status, headers, body and output view.

**Architecture:** Three new `functions/*` RPC methods proxy to the engine's discovery endpoints and **always return the raw HTTP exchange** (`{status, contentType, responseHeaders, body}`) instead of throwing on non-2xx. `/info` is hypermedia, so only the first path is built from scope; everything else follows `href`s. A shared `FunctionRunShell` in `designer-ui` is mounted both inside the function editor and as a standalone surface.

**Tech Stack:** TypeScript, Zod (params/result schemas), Vitest, React 19, Zustand, Tailwind + Radix, `@burgan-tech/pseudo-ui` (shadow-DOM view rendering).

**Spec:** [`docs/superpowers/specs/2026-08-05-function-quick-runner-design.md`](../specs/2026-08-05-function-quick-runner-design.md)

**Branch:** `f/function-quick-runner` (already created, off `f/function-contract-fields`).

---

## Deviation from the spec (deliberate)

Spec §4 lists `buildFunctionInfoPath` and `isValidRuntimePath` under `designer-ui/modules/function-run/functionRunPaths.ts`. **They belong in `services-core` instead:**

- `isValidRuntimePath` is a security boundary. A client-side-only check is not a check — the server must validate the `path` it is handed.
- `functions/getInfo` takes structured ids (`domain`, `functionKey`, `scope`, `workflowKey?`, `instanceId?`), so the **service** builds the info path. A client-side `buildFunctionInfoPath` would be dead code.

The client keeps only presentation helpers (`functionRunVerbs`, `functionRunPayload`, `functionRunStatus`).

---

## Gotcha: app-contracts changes need a rebuild before services-core typechecks

`services-core`'s `tsconfig.json` has a TS **project reference** to `app-contracts`. Project references resolve cross-package imports through the referenced project's **built `dist/*.d.ts`**, not its `src` — even though `package.json` points `types` at `src/index.ts`.

So after adding an export to `app-contracts` (Tasks 1 and 5 both do), `tsc --noEmit` in `services-core` fails with a spurious *"has no exported member"* until you rebuild:

```bash
pnpm --filter @vnext-forge-studio/app-contracts exec tsc -b --force
```

`dist` is gitignored, so this is a local artifact problem, not something that lands in a commit. Do not "fix" the source in response to this error — rebuild and re-check first.

## File Structure

**`packages/services-core/`**
| File | Responsibility |
|---|---|
| `src/services/runtime-proxy/runtime-proxy.service.ts` *(modify)* | Honour a caller `Content-Type` from a narrow allowlist |
| `src/services/function-run/function-run-paths.ts` *(new)* | `buildFunctionInfoPath`, `isValidRuntimePath` — pure |
| `src/services/function-run/function-run-schemas.ts` *(new)* | Zod params/result for the three methods |
| `src/services/function-run/function-run.service.ts` *(new)* | `getInfo`, `fetchContract`, `invoke` — never throw on non-2xx |
| `src/registry/method-registry.ts` *(modify)* | Register the three methods + `functionRunService` dep |
| `src/registry/policy.ts` *(modify)* | Mark all three `privileged` |
| `src/index.ts` *(modify)* | Export the new service factory + types |
| `test/fixtures/functions/*.json` *(new)* | Contract fixtures |

**`packages/app-contracts/src/method-http.ts`** *(modify)* — `MethodId` + HTTP spec for the three.

**`apps/server/src/api/v1/functions.routes.ts`** *(new)* — three POST routes via `createDispatchHelper`.

**`apps/server/src/composition/services.ts`**, **`apps/extension/src/composition/services.ts`** *(modify)* — construct `functionRunService`.

**`packages/designer-ui/src/modules/function-run/`** *(new)*
| File | Responsibility |
|---|---|
| `types/functionRun.types.ts` | `FunctionInfo`, `FunctionExchange`, `RunMode`, `ContentTypeId` |
| `FunctionRunApi.ts` | `callApi` wrappers over `functions/*` |
| `functionRunVerbs.ts` | `resolveVerbs`, `defaultVerbFor` |
| `functionRunPayload.ts` | `buildInvokeRequest`, `CONTENT_TYPES` |
| `functionRunStatus.ts` | `classifyStatus`, `isAuthorizationFailure` |
| `store/functionRunStore.ts` | Per-surface run state |
| `components/FunctionRunToolbar.tsx` | Verb selector, Invoke, Headers, F/I fields |
| `components/FunctionRunPayloadEditor.tsx` | Content-type selector + JSON/form editor |
| `components/FunctionRunInputPane.tsx` | View \| Payload toggle |
| `components/FunctionRunResponsePane.tsx` | Status, headers, body, output view |
| `components/FunctionRunAuthzBanner.tsx` | Explicit 401/403 surface |
| `FunctionRunShell.tsx` | Assembly |
| `index.ts` | Barrel |

**`packages/designer-ui/src/modules/quick-run/pseudo-ui/mergeQuickRunHeaders.ts`** *(modify)* — tool-wide layer.

**Hosts** — `FunctionEditorView.tsx` *(modify)*, `apps/web` route + page *(new)*, `apps/extension` panel + command + tree entry *(new)*.

---

# Phase A — Backend

### Task 1: runtime-proxy honours an allowlisted Content-Type

Today `Content-Type: application/json` is written **after** `callerHeaders` is spread, so a caller's value is silently overwritten and form-urlencoded is impossible.

**Files:**
- Modify: `packages/services-core/src/services/runtime-proxy/runtime-proxy.service.ts:70-94`
- Test: `packages/services-core/test/runtime-proxy-headers.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `packages/services-core/test/runtime-proxy-headers.test.ts`:

```ts
describe('buildRuntimeProxyOutboundHeaders — request Content-Type', () => {
  it('defaults to application/json for a body-bearing verb', () => {
    const headers = buildRuntimeProxyOutboundHeaders({ method: 'POST', body: '{"a":1}' })
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('honours an allowlisted caller Content-Type', () => {
    // Functions accept form-urlencoded; the Quick Runner must be able to send it.
    const headers = buildRuntimeProxyOutboundHeaders({
      method: 'POST',
      body: 'a=1&b=2',
      callerHeaders: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded')
  })

  it('matches the allowlist case-insensitively and ignores parameters', () => {
    const headers = buildRuntimeProxyOutboundHeaders({
      method: 'POST',
      body: 'a=1',
      callerHeaders: { 'content-type': 'Application/X-WWW-Form-Urlencoded; charset=UTF-8' },
    })
    expect(headers['Content-Type']).toBe('Application/X-WWW-Form-Urlencoded; charset=UTF-8')
  })

  it('falls back to JSON for a content type that is not allowlisted', () => {
    // Conservative default: this is a shared, security-relevant module.
    const headers = buildRuntimeProxyOutboundHeaders({
      method: 'POST',
      body: '<xml/>',
      callerHeaders: { 'Content-Type': 'application/xml' },
    })
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('never sets Content-Type on a verb that sends no body', () => {
    const headers = buildRuntimeProxyOutboundHeaders({
      method: 'GET',
      callerHeaders: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    expect(headers['Content-Type']).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
pnpm --filter @vnext-forge-studio/services-core exec vitest run test/runtime-proxy-headers.test.ts
```

Expected: the "honours an allowlisted caller Content-Type" and case-insensitive tests FAIL (received `application/json`).

- [ ] **Step 3: Implement**

Replace lines 70–94 of `runtime-proxy.service.ts`:

```ts
/**
 * Request content types a caller may choose. vNext functions accept JSON and
 * form-urlencoded; anything else falls back to JSON rather than erroring,
 * because this is a shared proxy and the conservative default is the safe one.
 */
export const RUNTIME_PROXY_ALLOWED_REQUEST_CONTENT_TYPES = [
  'application/json',
  'application/x-www-form-urlencoded',
] as const

function pickRequestContentType(callerHeaders: Record<string, string> | undefined): string {
  const supplied = Object.entries(callerHeaders ?? {}).find(
    ([name]) => name.toLowerCase() === 'content-type',
  )?.[1]
  if (!supplied) return 'application/json'
  // Compare on the media type alone so `; charset=UTF-8` still matches.
  const mediaType = supplied.split(';')[0]?.trim().toLowerCase() ?? ''
  const allowed = RUNTIME_PROXY_ALLOWED_REQUEST_CONTENT_TYPES.some((t) => t === mediaType)
  return allowed ? supplied : 'application/json'
}

export function buildRuntimeProxyOutboundHeaders(params: {
  method: string
  body?: string | undefined
  callerHeaders?: Record<string, string> | undefined
  traceId?: string | undefined
}): Record<string, string> {
  const method = params.method.toUpperCase()
  const stripped = stripHopByHopHeaders(params.callerHeaders)
  // Drop any caller Content-Type; it is re-applied below only when a body is
  // actually sent, and only after allowlist validation.
  for (const name of Object.keys(stripped)) {
    if (name.toLowerCase() === 'content-type') delete stripped[name]
  }

  const headers: Record<string, string> = {
    'User-Agent': RUNTIME_PROXY_USER_AGENT,
    Accept: 'application/json, text/plain, */*',
    ...stripped,
  }

  const hasBody = Boolean(params.body && params.body.length > 0)
  const sendsEntityBody = method !== 'GET' && method !== 'HEAD' && hasBody
  if (sendsEntityBody) {
    headers['Content-Type'] = pickRequestContentType(params.callerHeaders)
  }

  if (params.traceId) {
    headers['X-Trace-Id'] = params.traceId
  }

  return headers
}
```

Declare `RUNTIME_PROXY_ALLOWED_REQUEST_CONTENT_TYPES` in **`packages/app-contracts`**, not in `services-core`, and import it into the proxy. The client needs the same two strings (Task 8) and designer-ui may not import `services-core` under the dependency policy, so keeping the canonical pair in the shared contracts package is what stops the two sides drifting.

The allowlist must validate the **whole** header value, not just the media type: returning the caller's string verbatim after matching only the part before `;` lets `application/json;x=\r\nX-Evil: 1` through, and this doc comment presents the allowlist as the safety boundary. Preserve a well-formed `charset` parameter (non-ASCII form bodies need it) and fall back to JSON for anything else.

Extract the "which key is Content-Type" rule into a single `takeHeader(headers, lowerName)` helper that reads and deletes in one pass, then feed its result to a pure resolver. Writing the rule twice — once over `stripped`, once over the raw caller headers — makes the two silently disagree the day `content-type` joins the hop-by-hop list.

- [ ] **Step 4: Run to verify they pass**

```bash
pnpm --filter @vnext-forge-studio/services-core exec vitest run test/runtime-proxy-headers.test.ts
```

Expected: PASS, all pre-existing tests in the file still green.

- [ ] **Step 5: Commit**

```bash
git add packages/services-core/src/services/runtime-proxy/runtime-proxy.service.ts packages/services-core/src/index.ts packages/services-core/test/runtime-proxy-headers.test.ts
git commit -m "feat(runtime-proxy): honour allowlisted caller Content-Type"
```

---

### Task 2: Path building and href validation

**Files:**
- Create: `packages/services-core/src/services/function-run/function-run-paths.ts`
- Test: `packages/services-core/test/function-run-paths.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/services-core/test/function-run-paths.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { buildFunctionInfoPath, isValidRuntimePath } from '../src/index.js'

describe('buildFunctionInfoPath', () => {
  it('routes a domain-scoped function to the domain route', () => {
    expect(buildFunctionInfoPath({ domain: 'core', functionKey: 'get-branches', scope: 'D' })).toBe(
      '/api/v1/core/functions/get-branches/info',
    )
  })

  it('routes flow- and instance-scoped functions to the instance route', () => {
    // The domain route rejects F/I with 403, so sending them there would look
    // like an authorization problem instead of a routing mistake.
    for (const scope of ['F', 'I'] as const) {
      expect(
        buildFunctionInfoPath({
          domain: 'core', functionKey: 'calc-limit', scope,
          workflowKey: 'onboarding', instanceId: 'abc-123',
        }),
      ).toBe('/api/v1/core/workflows/onboarding/instances/abc-123/functions/calc-limit/info')
    }
  })

  it('rejects F/I without a workflow key or instance id', () => {
    expect(() =>
      buildFunctionInfoPath({ domain: 'core', functionKey: 'f', scope: 'F', instanceId: 'i' }),
    ).toThrow(/workflowKey/)
    expect(() =>
      buildFunctionInfoPath({ domain: 'core', functionKey: 'f', scope: 'I', workflowKey: 'w' }),
    ).toThrow(/instanceId/)
  })
})

describe('isValidRuntimePath', () => {
  it('accepts the href shapes /info returns', () => {
    expect(isValidRuntimePath('/core/functions/get-branches')).toBe(true)
    expect(isValidRuntimePath('/core/functions/get-branches/view?target=input')).toBe(true)
    expect(isValidRuntimePath('/core/workflows/w/instances/i-1/functions/f/schema?target=output')).toBe(true)
  })

  it('rejects anything that could leave the runtime origin', () => {
    expect(isValidRuntimePath('https://evil.test/core/functions/f')).toBe(false)
    expect(isValidRuntimePath('//evil.test/core/functions/f')).toBe(false)
    expect(isValidRuntimePath('/core/functions/../../admin')).toBe(false)
    expect(isValidRuntimePath('relative/functions/f')).toBe(false)
  })

  it('rejects a path that is not a function route', () => {
    expect(isValidRuntimePath('/core/workflows/w/instances/i')).toBe(false)
  })

  it('rejects empty input and fragments', () => {
    expect(isValidRuntimePath('')).toBe(false)
    expect(isValidRuntimePath('/core/functions/f#frag')).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter @vnext-forge-studio/services-core exec vitest run test/function-run-paths.test.ts
```

Expected: FAIL — `buildFunctionInfoPath is not exported`.

- [ ] **Step 3: Implement**

Create `packages/services-core/src/services/function-run/function-run-paths.ts`:

```ts
import { ERROR_CODES, VnextForgeError } from '@vnext-forge-studio/app-contracts'

export type FunctionScope = 'D' | 'F' | 'I'

export interface FunctionInfoPathInput {
  domain: string
  functionKey: string
  scope: FunctionScope
  workflowKey?: string | undefined
  instanceId?: string | undefined
}

/**
 * The single place that knows the scope→route rule.
 *
 * The engine exposes a function at two different routes and picks by scope;
 * the domain route answers 403 for an F/I function. Getting this wrong
 * surfaces as an authorization error, which sends the user hunting the wrong
 * bug — hence one tested function rather than string building at call sites.
 */
export function buildFunctionInfoPath(input: FunctionInfoPathInput): string {
  const { domain, functionKey, scope } = input
  if (scope === 'D') {
    return `/api/v1/${domain}/functions/${functionKey}/info`
  }
  if (!input.workflowKey) {
    throw new VnextForgeError(
      ERROR_CODES.API_BAD_REQUEST,
      `A ${scope}-scoped function needs a workflowKey.`,
      { source: 'buildFunctionInfoPath', layer: 'domain', details: { scope } },
    )
  }
  if (!input.instanceId) {
    throw new VnextForgeError(
      ERROR_CODES.API_BAD_REQUEST,
      `A ${scope}-scoped function needs an instanceId.`,
      { source: 'buildFunctionInfoPath', layer: 'domain', details: { scope } },
    )
  }
  return `/api/v1/${domain}/workflows/${input.workflowKey}/instances/${input.instanceId}/functions/${functionKey}/info`
}

const RUNTIME_PATH_PATTERN = /^\/[A-Za-z0-9._~\-/]*(\?[A-Za-z0-9._~\-/=&%]*)?$/

/**
 * Validates an href handed back by `/info` before it is proxied.
 *
 * Defence in depth: `runtime-proxy` already pins the origin to an allowlisted
 * base URL, so a bad path cannot reach another host. This stops path
 * traversal and non-function routes from riding in on a parameter.
 */
export function isValidRuntimePath(path: string): boolean {
  if (!path || !path.startsWith('/')) return false
  if (path.startsWith('//')) return false
  if (path.includes('..')) return false
  if (path.includes('#')) return false
  if (!RUNTIME_PATH_PATTERN.test(path)) return false
  return path.includes('/functions/')
}
```

Export both from `packages/services-core/src/index.ts`.

- [ ] **Step 4: Run to verify it passes**

```bash
pnpm --filter @vnext-forge-studio/services-core exec vitest run test/function-run-paths.test.ts
```

Expected: PASS (13 assertions).

- [ ] **Step 5: Commit**

```bash
git add packages/services-core/src/services/function-run/function-run-paths.ts packages/services-core/src/index.ts packages/services-core/test/function-run-paths.test.ts
git commit -m "feat(function-run): scope-aware info path + href validation"
```

---

### Task 3: Zod schemas

**Files:**
- Create: `packages/services-core/src/services/function-run/function-run-schemas.ts`

- [ ] **Step 1: Write the schemas**

```ts
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
  /** Parsed body when the content type is JSON and parsing succeeded. */
  json: z.unknown().optional(),
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
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @vnext-forge-studio/services-core exec tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add packages/services-core/src/services/function-run/function-run-schemas.ts
git commit -m "feat(function-run): params/result schemas"
```

---

### Task 4: The service

**Files:**
- Create: `packages/services-core/src/services/function-run/function-run.service.ts`
- Test: `packages/services-core/test/function-run-service.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest'

import { createFunctionRunService } from '../src/index.js'

function serviceWith(response: {
  status: number; contentType?: string; data: string; responseHeaders?: Record<string, string>
}) {
  const proxy = vi.fn().mockResolvedValue({
    status: response.status,
    contentType: response.contentType ?? 'application/json',
    data: response.data,
    responseHeaders: response.responseHeaders ?? {},
  })
  return { service: createFunctionRunService({ proxy } as never), proxy }
}

describe('functionRunService.getInfo', () => {
  it('builds the domain path and returns the parsed exchange', async () => {
    const { service, proxy } = serviceWith({ status: 200, data: '{"key":"get-branches"}' })
    const result = await service.getInfo({ domain: 'core', functionKey: 'get-branches', scope: 'D' })

    expect(proxy).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', runtimePath: '/api/v1/core/functions/get-branches/info' }),
      undefined,
    )
    expect(result.status).toBe(200)
    expect(result.json).toEqual({ key: 'get-branches' })
  })

  it('RETURNS a 403 instead of throwing', async () => {
    // The whole point of this service: an authorization refusal is data the
    // runner renders, not an exception that hides the status.
    const { service } = serviceWith({ status: 403, data: '{"detail":"forbidden"}' })
    const result = await service.getInfo({ domain: 'core', functionKey: 'f', scope: 'D' })
    expect(result.status).toBe(403)
    expect(result.json).toEqual({ detail: 'forbidden' })
  })

  it('returns a 500 with a non-JSON body and no json field', async () => {
    const { service } = serviceWith({ status: 500, contentType: 'text/plain', data: 'boom' })
    const result = await service.getInfo({ domain: 'core', functionKey: 'f', scope: 'D' })
    expect(result.status).toBe(500)
    expect(result.body).toBe('boom')
    expect(result.json).toBeUndefined()
  })

  it('surfaces response headers', async () => {
    const { service } = serviceWith({
      status: 200, data: '{}', responseHeaders: { 'x-trace-id': 't-1' },
    })
    const result = await service.getInfo({ domain: 'core', functionKey: 'f', scope: 'D' })
    expect(result.responseHeaders).toEqual({ 'x-trace-id': 't-1' })
  })
})

describe('functionRunService.fetchContract', () => {
  it('proxies a valid href', async () => {
    const { service, proxy } = serviceWith({ status: 200, data: '{"type":"view"}' })
    await service.fetchContract({ path: '/core/functions/f/view?target=input' })
    expect(proxy).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', runtimePath: '/core/functions/f/view?target=input' }),
      undefined,
    )
  })

  it('rejects an href that is not a runtime function path', async () => {
    const { service, proxy } = serviceWith({ status: 200, data: '{}' })
    await expect(service.fetchContract({ path: 'https://evil.test/x' })).rejects.toThrow(/path/i)
    expect(proxy).not.toHaveBeenCalled()
  })
})

describe('functionRunService.invoke', () => {
  it('sends a body and content type for POST', async () => {
    const { service, proxy } = serviceWith({ status: 200, data: '{"ok":true}' })
    await service.invoke({
      path: '/core/functions/f', verb: 'POST',
      body: 'a=1', contentType: 'application/x-www-form-urlencoded',
      headers: { authorization: 'Bearer t' },
    })
    expect(proxy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST', runtimePath: '/core/functions/f', body: 'a=1',
        headers: { authorization: 'Bearer t', 'content-type': 'application/x-www-form-urlencoded' },
      }),
      undefined,
    )
  })

  it('sends a query and no body for GET', async () => {
    const { service, proxy } = serviceWith({ status: 200, data: '[]' })
    await service.invoke({ path: '/core/functions/f', verb: 'GET', query: { page: '1' } })
    const call = proxy.mock.calls[0]![0]
    expect(call.query).toEqual({ page: '1' })
    expect(call.body).toBeUndefined()
  })

  it('returns a 422 from the function as data', async () => {
    const { service } = serviceWith({ status: 422, data: '{"errors":{"a":["required"]}}' })
    const result = await service.invoke({ path: '/core/functions/f', verb: 'POST' })
    expect(result.status).toBe(422)
    expect(result.json).toEqual({ errors: { a: ['required'] } })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter @vnext-forge-studio/services-core exec vitest run test/function-run-service.test.ts
```

Expected: FAIL — `createFunctionRunService is not exported`.

- [ ] **Step 3: Implement**

Create `packages/services-core/src/services/function-run/function-run.service.ts`:

```ts
import { ERROR_CODES, VnextForgeError } from '@vnext-forge-studio/app-contracts'
import { z } from 'zod'

import type { RuntimeProxyService } from '../runtime-proxy/runtime-proxy.service.js'
import { buildFunctionInfoPath, isValidRuntimePath } from './function-run-paths.js'
import {
  functionsFetchContractParams,
  functionsGetInfoParams,
  functionsInvokeParams,
  type functionExchangeResult,
} from './function-run-schemas.js'

type Exchange = z.infer<typeof functionExchangeResult>

function toExchange(result: {
  status: number
  contentType: string
  data: string
  responseHeaders?: Record<string, string>
}): Exchange {
  const exchange: Exchange = {
    status: result.status,
    contentType: result.contentType,
    responseHeaders: result.responseHeaders ?? {},
    body: result.data,
  }
  // Parse only when the engine says JSON. A parse failure is not an error —
  // the raw body is still shown, which is exactly what the runner needs when
  // a function returns a malformed payload.
  if (result.contentType.toLowerCase().includes('json') && result.data.length > 0) {
    try {
      exchange.json = JSON.parse(result.data)
    } catch {
      /* leave `json` unset; `body` carries the raw text */
    }
  }
  return exchange
}

function assertRuntimePath(path: string, source: string): void {
  if (isValidRuntimePath(path)) return
  throw new VnextForgeError(
    ERROR_CODES.API_FORBIDDEN,
    'Refusing to proxy a path that is not a runtime function route.',
    { source, layer: 'domain', details: { path } },
  )
}

export function createFunctionRunService(runtimeProxyService: RuntimeProxyService) {
  async function exchange(
    req: {
      method: string
      runtimePath: string
      query?: Record<string, string>
      body?: string
      headers?: Record<string, string>
      runtimeUrl?: string
    },
    traceId?: string,
  ): Promise<Exchange> {
    const result = await runtimeProxyService.proxy(req, traceId)
    return toExchange(result)
  }

  async function getInfo(
    params: z.infer<typeof functionsGetInfoParams>,
    traceId?: string,
  ): Promise<Exchange> {
    const runtimePath = buildFunctionInfoPath({
      domain: params.domain,
      functionKey: params.functionKey,
      scope: params.scope,
      workflowKey: params.workflowKey,
      instanceId: params.instanceId,
    })
    return exchange(
      { method: 'GET', runtimePath, headers: params.headers, runtimeUrl: params.runtimeUrl },
      traceId,
    )
  }

  async function fetchContract(
    params: z.infer<typeof functionsFetchContractParams>,
    traceId?: string,
  ): Promise<Exchange> {
    assertRuntimePath(params.path, 'FunctionRunService.fetchContract')
    return exchange(
      { method: 'GET', runtimePath: params.path, headers: params.headers, runtimeUrl: params.runtimeUrl },
      traceId,
    )
  }

  async function invoke(
    params: z.infer<typeof functionsInvokeParams>,
    traceId?: string,
  ): Promise<Exchange> {
    assertRuntimePath(params.path, 'FunctionRunService.invoke')
    const sendsBody = params.verb === 'POST' || params.verb === 'PATCH'
    const headers = { ...(params.headers ?? {}) }
    if (sendsBody && params.contentType) {
      headers['content-type'] = params.contentType
    }
    return exchange(
      {
        method: params.verb,
        runtimePath: params.path,
        query: sendsBody ? undefined : params.query,
        body: sendsBody ? params.body : undefined,
        headers,
        runtimeUrl: params.runtimeUrl,
      },
      traceId,
    )
  }

  return { getInfo, fetchContract, invoke }
}

export type FunctionRunService = ReturnType<typeof createFunctionRunService>
```

Export the factory and type from `packages/services-core/src/index.ts`.

- [ ] **Step 4: Run to verify it passes**

```bash
pnpm --filter @vnext-forge-studio/services-core exec vitest run test/function-run-service.test.ts
```

Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/services-core/src/services/function-run/function-run.service.ts packages/services-core/src/index.ts packages/services-core/test/function-run-service.test.ts
git commit -m "feat(function-run): service returning the raw HTTP exchange"
```

---

### Task 5: Register the methods

**Files:**
- Modify: `packages/services-core/src/registry/method-registry.ts` (dep type ~line 174; entries after the `quickrun` block ~line 676)
- Modify: `packages/services-core/src/registry/policy.ts` (after the `quickrun` block ~line 99)
- Modify: `packages/app-contracts/src/method-http.ts` (`MethodId` union; `METHOD_HTTP_METADATA`)
- Create: `packages/services-core/test/fixtures/functions/getInfo.json`, `fetchContract.json`, `invoke.json`

- [ ] **Step 1: Add the method ids and HTTP metadata**

In `packages/app-contracts/src/method-http.ts`, add to the `MethodId` union:

```ts
  | 'functions/getInfo'
  | 'functions/fetchContract'
  | 'functions/invoke'
```

and to `METHOD_HTTP_METADATA`:

```ts
  'functions/getInfo': { verb: 'POST', paramSource: 'json' },
  'functions/fetchContract': { verb: 'POST', paramSource: 'json' },
  'functions/invoke': { verb: 'POST', paramSource: 'json' },
```

- [ ] **Step 2: Add the policy entries**

In `packages/services-core/src/registry/policy.ts`, after the `quickrun` block:

```ts
  // ── functions — the Quick Runner's discovery + invoke path; proxies to the
  // runtime engine exactly as quickrun/* does.
  'functions/getInfo': 'privileged',
  'functions/fetchContract': 'privileged',
  'functions/invoke': 'privileged',
```

- [ ] **Step 3: Register the handlers**

In `method-registry.ts`, add to the deps interface next to `quickRunService: QuickRunService`:

```ts
  functionRunService: FunctionRunService
```

and the entries after the `quickrun` block:

```ts
    // ── functions (Quick Runner) ─────────────────────────────────────────────
    'functions/getInfo': {
      paramsSchema: functionsGetInfoParams,
      resultSchema: functionsGetInfoResult,
      handler: async (params, { functionRunService }, traceId) =>
        functionRunService.getInfo(params, traceId),
    },
    'functions/fetchContract': {
      paramsSchema: functionsFetchContractParams,
      resultSchema: functionsFetchContractResult,
      handler: async (params, { functionRunService }, traceId) =>
        functionRunService.fetchContract(params, traceId),
    },
    'functions/invoke': {
      paramsSchema: functionsInvokeParams,
      resultSchema: functionsInvokeResult,
      handler: async (params, { functionRunService }, traceId) =>
        functionRunService.invoke(params, traceId),
    },
```

with the matching imports from `../services/function-run/function-run-schemas.js` and `../services/function-run/function-run.service.js`.

- [ ] **Step 4: Add the fixtures**

`packages/services-core/test/fixtures/functions/getInfo.json`:

```json
{
  "params": { "domain": "core", "functionKey": "get-branches", "scope": "D" },
  "result": {
    "status": 200,
    "contentType": "application/json",
    "responseHeaders": { "x-trace-id": "fixture-trace" },
    "body": "{\"key\":\"get-branches\",\"scope\":\"D\"}",
    "json": { "key": "get-branches", "scope": "D" }
  }
}
```

`fetchContract.json`:

```json
{
  "params": { "path": "/core/functions/get-branches/view?target=input" },
  "result": {
    "status": 200,
    "contentType": "application/json",
    "responseHeaders": {},
    "body": "{\"key\":\"branch-form\",\"type\":\"pseudo-ui\"}",
    "json": { "key": "branch-form", "type": "pseudo-ui" }
  }
}
```

`invoke.json`:

```json
{
  "params": { "path": "/core/functions/get-branches", "verb": "GET" },
  "result": {
    "status": 200,
    "contentType": "application/json",
    "responseHeaders": {},
    "body": "[]",
    "json": []
  }
}
```

- [ ] **Step 5: Run the contract test**

```bash
pnpm --filter @vnext-forge-studio/services-core exec vitest run test/registry-contract.test.ts
```

Expected: PASS — including "METHOD_HTTP_METADATA keys match registry keys (parity)".

- [ ] **Step 6: Commit**

```bash
git add packages/app-contracts/src/method-http.ts packages/services-core/src/registry packages/services-core/test/fixtures/functions
git commit -m "feat(function-run): register functions/* methods with policy and fixtures"
```

---

### Task 6: Compose the service and add server routes

**Files:**
- Create: `apps/server/src/api/v1/functions.routes.ts`
- Modify: `apps/server/src/composition/services.ts`, `apps/extension/src/composition/services.ts`
- Modify: wherever `apps/server` registers v1 route modules

- [ ] **Step 1: Construct the service in both shells**

In each composition file, next to `const quickRunService = createQuickRunService(runtimeProxyService)`:

```ts
const functionRunService = createFunctionRunService(runtimeProxyService);
```

and add `functionRunService,` to the deps object passed to `buildMethodRegistry`.

- [ ] **Step 2: Add the routes**

Create `apps/server/src/api/v1/functions.routes.ts`, mirroring `quickrun.routes.ts`:

```ts
import { Hono } from 'hono';

import { createDispatchHelper } from './lib/dispatch-helper.js';

export function registerFunctionsRoutes(app: Hono) {
  const helper = createDispatchHelper();

  app.post('/functions/getInfo', (c) => helper(c, 'functions/getInfo', { source: 'json' }));
  app.post('/functions/fetchContract', (c) => helper(c, 'functions/fetchContract', { source: 'json' }));
  app.post('/functions/invoke', (c) => helper(c, 'functions/invoke', { source: 'json' }));

  return app;
}
```

Register it alongside the other v1 route modules.

> Match the exact import path, factory signature and registration style used by `quickrun.routes.ts` in this repo — copy its shape rather than the sketch above if they differ.

- [ ] **Step 3: Typecheck both shells**

```bash
pnpm --filter @vnext-forge-studio/server exec tsc --noEmit && pnpm --filter vnext-forge-studio exec tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src apps/extension/src/composition/services.ts
git commit -m "feat(function-run): wire the service into both shells"
```

---

# Phase B — Client logic (pure, TDD)

### Task 7: Verb resolution

**Files:**
- Create: `packages/designer-ui/src/modules/function-run/functionRunVerbs.ts`
- Test: `packages/designer-ui/src/modules/function-run/functionRunVerbs.vitest.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import { defaultVerbFor, resolveVerbs } from './functionRunVerbs'

describe('resolveVerbs', () => {
  it('uses the declared verbs', () => {
    expect(resolveVerbs(['GET', 'POST'])).toEqual(['GET', 'POST'])
  })

  it('falls back to all four when the contract declares none', () => {
    // "When omitted or empty, no verb restriction is applied."
    expect(resolveVerbs(undefined)).toEqual(['GET', 'POST', 'PATCH', 'DELETE'])
    expect(resolveVerbs([])).toEqual(['GET', 'POST', 'PATCH', 'DELETE'])
  })

  it('drops verbs outside the contract enum and keeps canonical order', () => {
    expect(resolveVerbs(['DELETE', 'PUT', 'GET'])).toEqual(['GET', 'DELETE'])
  })

  it('falls back when every declared verb is unknown', () => {
    expect(resolveVerbs(['PUT', 'HEAD'])).toEqual(['GET', 'POST', 'PATCH', 'DELETE'])
  })
})

describe('defaultVerbFor', () => {
  it('prefers GET when available', () => {
    expect(defaultVerbFor(['POST', 'GET'])).toBe('GET')
  })

  it('otherwise takes the first', () => {
    expect(defaultVerbFor(['POST', 'PATCH'])).toBe('POST')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/function-run/functionRunVerbs.vitest.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import { FUNCTION_VERBS, type FunctionVerb } from '@vnext-forge-studio/vnext-types';

/**
 * Verbs the runner offers. An absent or empty `verbs` means "no verb
 * restriction", so the runner offers all four rather than none.
 */
export function resolveVerbs(declared: readonly string[] | undefined): FunctionVerb[] {
  const known = FUNCTION_VERBS.filter((verb) => declared?.includes(verb));
  return known.length > 0 ? [...known] : [...FUNCTION_VERBS];
}

/** GET is the safest default — it cannot mutate anything. */
export function defaultVerbFor(verbs: readonly FunctionVerb[]): FunctionVerb {
  return verbs.includes('GET') ? 'GET' : (verbs[0] ?? 'GET');
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/function-run/functionRunVerbs.vitest.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/designer-ui/src/modules/function-run/functionRunVerbs.ts packages/designer-ui/src/modules/function-run/functionRunVerbs.vitest.test.ts
git commit -m "feat(function-run): verb resolution"
```

---

### Task 8: `buildInvokeRequest`

One function, because the three decisions are coupled: a GET never carries a body regardless of content type, and the two content types encode the same map differently.

**Files:**
- Create: `packages/designer-ui/src/modules/function-run/functionRunPayload.ts`
- Test: `packages/designer-ui/src/modules/function-run/functionRunPayload.vitest.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import { buildInvokeRequest, CONTENT_TYPES } from './functionRunPayload'

const PAYLOAD = { branchCode: '001', includeClosed: true }

describe('buildInvokeRequest — body-bearing verbs', () => {
  it('sends JSON for POST', () => {
    expect(
      buildInvokeRequest({ verb: 'POST', mode: 'payload', payload: PAYLOAD, contentType: 'json' }),
    ).toEqual({ body: JSON.stringify(PAYLOAD), contentType: 'application/json' })
  })

  it('sends form-urlencoded for POST', () => {
    const result = buildInvokeRequest({
      verb: 'POST', mode: 'payload', payload: PAYLOAD, contentType: 'form',
    })
    expect(result.contentType).toBe('application/x-www-form-urlencoded')
    expect(result.body).toBe('branchCode=001&includeClosed=true')
    expect(result.query).toBeUndefined()
  })

  it('treats PATCH like POST', () => {
    expect(buildInvokeRequest({ verb: 'PATCH', mode: 'payload', payload: PAYLOAD, contentType: 'json' }).body)
      .toBe(JSON.stringify(PAYLOAD))
  })
})

describe('buildInvokeRequest — verbs that carry no body', () => {
  it('turns the payload into a query for GET and never sets a body', () => {
    const result = buildInvokeRequest({ verb: 'GET', mode: 'payload', payload: PAYLOAD, contentType: 'json' })
    expect(result.body).toBeUndefined()
    expect(result.contentType).toBeUndefined()
    expect(result.query).toEqual({ branchCode: '001', includeClosed: 'true' })
  })

  it('does the same for DELETE regardless of the selected content type', () => {
    const result = buildInvokeRequest({ verb: 'DELETE', mode: 'payload', payload: PAYLOAD, contentType: 'form' })
    expect(result.body).toBeUndefined()
    expect(result.query).toEqual({ branchCode: '001', includeClosed: 'true' })
  })

  it('stringifies nested values for the query rather than dropping them', () => {
    const result = buildInvokeRequest({
      verb: 'GET', mode: 'payload', payload: { filter: { a: 1 } }, contentType: 'json',
    })
    expect(result.query).toEqual({ filter: '{"a":1}' })
  })
})

describe('buildInvokeRequest — mode selection', () => {
  it('sends the view form data in view mode', () => {
    const result = buildInvokeRequest({
      verb: 'POST', mode: 'view', viewFormData: { fromView: 1 }, payload: { fromPayload: 2 },
      contentType: 'json',
    })
    expect(result.body).toBe(JSON.stringify({ fromView: 1 }))
  })

  it('sends the payload editor content in payload mode', () => {
    const result = buildInvokeRequest({
      verb: 'POST', mode: 'payload', viewFormData: { fromView: 1 }, payload: { fromPayload: 2 },
      contentType: 'json',
    })
    expect(result.body).toBe(JSON.stringify({ fromPayload: 2 }))
  })
})

describe('buildInvokeRequest — empty input', () => {
  it('omits the body entirely when there is nothing to send', () => {
    expect(buildInvokeRequest({ verb: 'POST', mode: 'payload', payload: {}, contentType: 'json' }))
      .toEqual({ body: undefined, contentType: undefined, query: undefined })
  })

  it('omits the query when there is nothing to send', () => {
    expect(buildInvokeRequest({ verb: 'GET', mode: 'payload', payload: {}, contentType: 'json' }).query)
      .toBeUndefined()
  })
})

describe('CONTENT_TYPES', () => {
  it('exposes exactly the two media types the proxy allows', () => {
    expect(CONTENT_TYPES.json).toBe('application/json')
    expect(CONTENT_TYPES.form).toBe('application/x-www-form-urlencoded')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/function-run/functionRunPayload.vitest.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import { RUNTIME_PROXY_ALLOWED_REQUEST_CONTENT_TYPES } from '@vnext-forge-studio/app-contracts';
import type { FunctionVerb } from '@vnext-forge-studio/vnext-types';

/**
 * The two media types `runtime-proxy` will forward, keyed for the UI selector.
 *
 * The strings themselves come from `app-contracts` so the client and the proxy
 * cannot drift apart — designer-ui may not import `services-core`, so a local
 * copy would be unlinked from the allowlist that actually enforces this.
 */
export const CONTENT_TYPES = {
  json: RUNTIME_PROXY_ALLOWED_REQUEST_CONTENT_TYPES[0],
  form: RUNTIME_PROXY_ALLOWED_REQUEST_CONTENT_TYPES[1],
} as const;

export type ContentTypeId = keyof typeof CONTENT_TYPES;
export type RunMode = 'view' | 'payload';

export interface InvokeRequestInput {
  verb: FunctionVerb;
  mode: RunMode;
  /** Form data lifted out of the rendered input view. */
  viewFormData?: Record<string, unknown> | undefined;
  /** Content of the free payload editor. */
  payload?: Record<string, unknown> | undefined;
  contentType: ContentTypeId;
}

export interface InvokeRequest {
  body?: string | undefined;
  contentType?: string | undefined;
  query?: Record<string, string> | undefined;
}

function toQueryValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  // Nested structures survive as JSON rather than becoming "[object Object]".
  return JSON.stringify(value);
}

/**
 * Turns the runner's current state into the wire parameters for
 * `functions/invoke`.
 *
 * Kept as one function because the decisions are coupled: GET and DELETE carry
 * no body whatever content type is selected, and the two content types encode
 * the same map differently. Splitting it invites a call site that encodes a
 * body for a verb that cannot send one.
 */
export function buildInvokeRequest(input: InvokeRequestInput): InvokeRequest {
  const source = input.mode === 'view' ? input.viewFormData : input.payload;
  const entries = Object.entries(source ?? {});

  if (entries.length === 0) {
    return { body: undefined, contentType: undefined, query: undefined };
  }

  const carriesBody = input.verb === 'POST' || input.verb === 'PATCH';
  if (!carriesBody) {
    const query: Record<string, string> = {};
    for (const [key, value] of entries) query[key] = toQueryValue(value);
    return { body: undefined, contentType: undefined, query };
  }

  if (input.contentType === 'form') {
    const search = new URLSearchParams();
    for (const [key, value] of entries) search.append(key, toQueryValue(value));
    return { body: search.toString(), contentType: CONTENT_TYPES.form, query: undefined };
  }

  return {
    body: JSON.stringify(Object.fromEntries(entries)),
    contentType: CONTENT_TYPES.json,
    query: undefined,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/function-run/functionRunPayload.vitest.test.ts
```

Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/designer-ui/src/modules/function-run/functionRunPayload.ts packages/designer-ui/src/modules/function-run/functionRunPayload.vitest.test.ts
git commit -m "feat(function-run): buildInvokeRequest"
```

---

### Task 9: Status classification

**Files:**
- Create: `packages/designer-ui/src/modules/function-run/functionRunStatus.ts`
- Test: `packages/designer-ui/src/modules/function-run/functionRunStatus.vitest.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import { classifyStatus, isAuthorizationFailure } from './functionRunStatus'

describe('classifyStatus', () => {
  it('classifies each class at its boundaries', () => {
    expect(classifyStatus(199)).toBe('informational')
    expect(classifyStatus(200)).toBe('success')
    expect(classifyStatus(299)).toBe('success')
    expect(classifyStatus(300)).toBe('redirect')
    expect(classifyStatus(399)).toBe('redirect')
    expect(classifyStatus(400)).toBe('client-error')
    expect(classifyStatus(499)).toBe('client-error')
    expect(classifyStatus(500)).toBe('server-error')
  })
})

describe('isAuthorizationFailure', () => {
  it('detects the two statuses that mean "you may not run this"', () => {
    expect(isAuthorizationFailure(401)).toBe(true)
    expect(isAuthorizationFailure(403)).toBe(true)
  })

  it('does not treat other client errors as authorization failures', () => {
    // 404 means "no sys-functions component", not a permission problem.
    expect(isAuthorizationFailure(404)).toBe(false)
    expect(isAuthorizationFailure(422)).toBe(false)
    expect(isAuthorizationFailure(200)).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/function-run/functionRunStatus.vitest.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
export type StatusClass =
  | 'informational'
  | 'success'
  | 'redirect'
  | 'client-error'
  | 'server-error';

export function classifyStatus(status: number): StatusClass {
  if (status >= 500) return 'server-error';
  if (status >= 400) return 'client-error';
  if (status >= 300) return 'redirect';
  if (status >= 200) return 'success';
  return 'informational';
}

/**
 * The runtime shares one `IFunctionAccessPolicy` between discovery and
 * execution, so a 403 on `/info` means the same denial as a 403 on invoke.
 * Worth its own banner: it is a permissions problem, not a broken function.
 */
export function isAuthorizationFailure(status: number): boolean {
  return status === 401 || status === 403;
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/function-run/functionRunStatus.vitest.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/designer-ui/src/modules/function-run/functionRunStatus.ts packages/designer-ui/src/modules/function-run/functionRunStatus.vitest.test.ts
git commit -m "feat(function-run): status classification"
```

---

### Task 10: Tool-wide header layer

**Files:**
- Modify: `packages/designer-ui/src/modules/quick-run/pseudo-ui/mergeQuickRunHeaders.ts`
- Modify: `packages/designer-ui/src/modules/quick-run/pseudo-ui/mergeQuickRunHeaders.vitest.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to the existing test file:

```ts
describe('mergeQuickRunHeaders — tool-wide layer', () => {
  it('applies tool-wide headers as the lowest priority layer', () => {
    const merged = mergeQuickRunHeaders(
      { globalHeaders: { b: 'bucket' } } as never,
      { c: 'session' },
      { d: 'extra' },
      { a: 'tool', b: 'tool', c: 'tool', d: 'tool' },
    )
    expect(merged).toEqual({ a: 'tool', b: 'bucket', c: 'session', d: 'extra' })
  })

  it('works with only the tool-wide layer set', () => {
    expect(mergeQuickRunHeaders(null, undefined, undefined, { authorization: 'Bearer t' }))
      .toEqual({ authorization: 'Bearer t' })
  })

  it('is unchanged when no tool-wide headers are supplied', () => {
    expect(mergeQuickRunHeaders({ globalHeaders: { a: '1' } } as never, { b: '2' }))
      .toEqual({ a: '1', b: '2' })
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/quick-run/pseudo-ui/mergeQuickRunHeaders.vitest.test.ts
```

Expected: FAIL — the fourth argument is ignored, so `a` is missing.

- [ ] **Step 3: Implement**

Replace the function body, keeping the existing doc comment and extending it:

```ts
/**
 * The single header-merge rule for every Quick Run engine call.
 *
 * Priority, lowest → highest:
 *   `toolWide` → `bucketConfig.globalHeaders` → `sessionHeaders` → `extra`
 *
 * `toolWide` is the Forge-wide header set shared by the workflow runner and
 * the function runner, so an auth token is entered once and applies
 * everywhere. Per-workflow headers still override it, so existing setups keep
 * their behaviour.
 *
 * `extra` exists for the per-transition delta the manual TransitionDialog
 * persists; ordinary callers omit it.
 */
export function mergeQuickRunHeaders(
  bucketConfig: WorkflowBucketConfig | null | undefined,
  sessionHeaders: Record<string, string> | undefined,
  extra?: Record<string, string>,
  toolWide?: Record<string, string>,
): Record<string, string> {
  return {
    ...(toolWide ?? {}),
    ...(bucketConfig?.globalHeaders ?? {}),
    ...(sessionHeaders ?? {}),
    ...(extra ?? {}),
  };
}
```

`toolWide` is the **fourth** parameter so no existing call site changes.

- [ ] **Step 4: Run to verify they pass**

```bash
pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/quick-run/pseudo-ui/mergeQuickRunHeaders.vitest.test.ts
```

Expected: PASS — the six pre-existing tests plus the three new ones.

- [ ] **Step 5: Commit**

```bash
git add packages/designer-ui/src/modules/quick-run/pseudo-ui/mergeQuickRunHeaders.ts packages/designer-ui/src/modules/quick-run/pseudo-ui/mergeQuickRunHeaders.vitest.test.ts
git commit -m "feat(quick-run): tool-wide global header layer"
```

---

### Task 11: Types and API client

**Files:**
- Create: `packages/designer-ui/src/modules/function-run/types/functionRun.types.ts`
- Create: `packages/designer-ui/src/modules/function-run/FunctionRunApi.ts`

- [ ] **Step 1: Write the types**

```ts
import type { FunctionVerb } from '@vnext-forge-studio/vnext-types';

/** One slot's discovery entry from `/info`. */
export interface ContractSlotInfo {
  hasView?: boolean;
  hasSchema?: boolean;
  loadData?: boolean;
  href: string;
}

/** The `/info` payload. */
export interface FunctionInfo {
  key: string;
  domain: string;
  version: string;
  scope: 'D' | 'F' | 'I';
  function: { verbs?: FunctionVerb[]; href: string };
  rawResponse?: boolean;
  cacheable?: boolean;
  inputView?: ContractSlotInfo;
  outputView?: ContractSlotInfo;
  inputSchema?: ContractSlotInfo;
  outputSchema?: ContractSlotInfo;
}

/** What every `functions/*` method returns — the raw HTTP exchange. */
export interface FunctionExchange {
  status: number;
  contentType: string;
  responseHeaders: Record<string, string>;
  body: string;
  json?: unknown;
}
```

- [ ] **Step 2: Write the API client**

```ts
import { callApi } from '../../api/client';
import type { ApiResponse } from '@vnext-forge-studio/app-contracts';

import type { FunctionExchange } from './types/functionRun.types';

export interface GetInfoParams {
  domain: string;
  functionKey: string;
  scope: 'D' | 'F' | 'I';
  workflowKey?: string;
  instanceId?: string;
  headers?: Record<string, string>;
  runtimeUrl?: string;
}

export async function getInfo(params: GetInfoParams): Promise<ApiResponse<FunctionExchange>> {
  return callApi({ method: 'functions/getInfo', params });
}

export interface FetchContractParams {
  path: string;
  headers?: Record<string, string>;
  runtimeUrl?: string;
}

export async function fetchContract(
  params: FetchContractParams,
): Promise<ApiResponse<FunctionExchange>> {
  return callApi({ method: 'functions/fetchContract', params });
}

export interface InvokeParams {
  path: string;
  verb: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: string;
  contentType?: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  runtimeUrl?: string;
}

export async function invoke(params: InvokeParams): Promise<ApiResponse<FunctionExchange>> {
  return callApi({ method: 'functions/invoke', params });
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @vnext-forge-studio/designer-ui exec tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add packages/designer-ui/src/modules/function-run/types packages/designer-ui/src/modules/function-run/FunctionRunApi.ts
git commit -m "feat(function-run): client types and API wrappers"
```

---

# Phase C — Client UI

> Follow the house style used across `designer-ui`: Tailwind + Radix + `src/ui/*` primitives, **no PrimeReact** outside the pseudo-ui sandbox. Card/section chrome mirrors `FunctionCacheSection`; response chrome mirrors `InstanceDashboard`'s `ResponseHeadersSection`.

### Task 12: Run store

**Files:**
- Create: `packages/designer-ui/src/modules/function-run/store/functionRunStore.ts`

- [ ] **Step 1: Implement**

```ts
import { create } from 'zustand';

import type { ContentTypeId, RunMode } from '../functionRunPayload';
import type { FunctionExchange, FunctionInfo } from '../types/functionRun.types';

interface FunctionRunState {
  info: FunctionInfo | null;
  infoExchange: FunctionExchange | null;
  infoLoading: boolean;
  /** Populated when /info itself failed (403, 404, transport). */
  infoError: string | null;

  verb: string | null;
  mode: RunMode;
  contentType: ContentTypeId;
  payload: Record<string, unknown>;
  viewFormData: Record<string, unknown>;

  /** Scope F/I only. */
  workflowKey: string;
  instanceId: string;

  inputViewContent: unknown;
  outputViewContent: unknown;
  inputSchema: Record<string, unknown> | null;

  invoking: boolean;
  response: FunctionExchange | null;
  responseDurationMs: number | null;

  set: (patch: Partial<FunctionRunState>) => void;
  reset: () => void;
}

const INITIAL = {
  info: null, infoExchange: null, infoLoading: false, infoError: null,
  verb: null, mode: 'payload' as RunMode, contentType: 'json' as ContentTypeId,
  payload: {}, viewFormData: {},
  workflowKey: '', instanceId: '',
  inputViewContent: null, outputViewContent: null, inputSchema: null,
  invoking: false, response: null, responseDurationMs: null,
};

export const useFunctionRunStore = create<FunctionRunState>((set) => ({
  ...INITIAL,
  set: (patch) => set(patch),
  reset: () => set(INITIAL),
}));
```

- [ ] **Step 2: Typecheck and commit**

```bash
pnpm --filter @vnext-forge-studio/designer-ui exec tsc --noEmit
git add packages/designer-ui/src/modules/function-run/store/functionRunStore.ts
git commit -m "feat(function-run): run store"
```

---
### Task 12b: Expose the rendered view's form data

**This task exists because the approved design cannot be built without it.** The design says the runner owns the Invoke button and the input view is "just a form". But `PseudoUiViewSurface` keeps `formData` in local state (`PseudoUiViewSurface.tsx:500`, `onFormChange={(next) => setFormData(next)}`) and never lifts it out — today the only way form data escapes is through `delegate.onAction`, which fires on a user action, not on every keystroke. So a runner-owned Invoke button has nothing to send in view mode.

`PseudoUiPseudoViewFrame` already accepts an `onFormChange` prop and forwards it to the SDK. The change is to make it optional-passthrough one level up.

**Files:**
- Modify: `packages/designer-ui/src/modules/quick-run/pseudo-ui/PseudoUiViewSurface.tsx`
- Modify: `packages/designer-ui/src/modules/quick-run/pseudo-ui/PseudoUiOrJsonBlock.tsx`

- [ ] **Step 1: Add the prop to `PseudoUiViewSurface`**

Add to `PseudoUiViewSurfaceProps`:

```ts
  /**
   * Called on every form change inside the rendered view.
   *
   * The surface keeps `formData` in its own state so the SDK stays
   * controlled; this is a read-only tap for hosts that need the current
   * values without waiting for an action. The Function Quick Runner needs it
   * because its Invoke button lives outside the view — the view collects
   * input, the runner decides when to send it.
   */
  onFormChange?: (data: Record<string, unknown>) => void;
```

At line ~500, keep the existing `setFormData` and add the notification:

```tsx
        onFormChange={(next) => {
          setFormData(next);
          onFormChange?.(next);
        }}
```

- [ ] **Step 2: Thread it through `PseudoUiOrJsonBlock`**

Add `onFormChange?: (data: Record<string, unknown>) => void;` to `PseudoUiOrJsonBlockProps` and pass it to `PseudoUiViewSurface`. The JSON branch ignores it — there is no form to change.

- [ ] **Step 3: Verify nothing regressed**

```bash
pnpm --filter @vnext-forge-studio/designer-ui exec vitest run
pnpm --filter @vnext-forge-studio/designer-ui exec tsc --noEmit -p tsconfig.json
```

Both props are optional, so every existing call site is unaffected. Expected: 563/563 still, tsc clean.

- [ ] **Step 4: Commit**

```bash
git add packages/designer-ui/src/modules/quick-run/pseudo-ui/PseudoUiViewSurface.tsx packages/designer-ui/src/modules/quick-run/pseudo-ui/PseudoUiOrJsonBlock.tsx
git commit -m "feat(pseudo-ui): optional onFormChange tap on the view surface"
```

---

## Primitive signatures for Tasks 13–16

Verified against source. Use these; do not guess.

```ts
// ui/Select — a native <select> wrapper. Children are <option> elements.
<Select value={string} onChange={(e) => …} className?={string}>…</Select>

// ui/Input — extends native input props.
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: React.ReactNode; hoverable?: boolean; inputClassName?: string;
  leading?: React.ReactNode; trailing?: React.ReactNode; size?: 'sm' | …;
}

// ui/Field — label + children + hint + error.
<Field label={string} hint?={string} errorMsg?={string} required?={boolean} className?={string}>

// modules/schema-form — a discriminated union; pick ONE value form.
type SchemaFormProps =
  | { schema; value: string;  onChange: (next: string) => void;  showRawToggle?; jsonEditorRows?; jsonEditorLabel?; showAllErrors? }
  | { schema; objectValue: Record<string, unknown>; onObjectChange: (next: Record<string, unknown>) => void; /* …same optionals */ };

// modules/quick-run/components/CopyableJsonBlock
<CopyableJsonBlock value={unknown} fillHeight?={boolean} />
<JsonEditorWithCopy value={string} onChange={(v: string) => void} rows?={number} label?={string} />

// modules/quick-run/components/HeadersConfigDialog
// NOTE: neither HeaderEntry nor the props interface is exported — build the array inline.
<HeadersConfigDialog open={boolean} onClose={() => void}
  initialHeaders={{ name: string; value: string; isSecret?: boolean }[]}
  onSave={(headers) => void} />

// modules/quick-run/pseudo-ui/PseudoUiOrJsonBlock — takes a ViewResponse, NOT raw content.
<PseudoUiOrJsonBlock
  view={ViewResponse} jsonValue={unknown} displayContent={string}
  ariaLabel={string} integrationMode={'simulation' | 'preview'}
  panelStorageScope?={string} onFormChange?={(d) => void}  // ← added in Task 12b
  delegate? pseudoUiSchema? resolveSchema? instanceData? initialFormData? fillHeight? onPseudoError? />

// modules/quick-run/types/quickrun.types
interface ViewResponse {
  key: string; content: string | Record<string, unknown>; type: string;
  display?: string; modes?: …; label?: string; renderer?: ViewRenderer;
}
```

**The adapter this implies.** `functions/fetchContract` returns a `FunctionExchange` (`{status, contentType, body, json?}`), but `PseudoUiOrJsonBlock` needs a `ViewResponse`. Task 15 must convert one to the other — the view JSON arrives in `exchange.json`, and `key`/`type`/`renderer` come from that payload. Write this as a small pure `toViewResponse(exchange)` in `functionRunPayload.ts`'s sibling (a new `functionRunView.ts`) with a colocated test, rather than inline in JSX.

---

### Task 13: Toolbar

**Files:**
- Create: `packages/designer-ui/src/modules/function-run/components/FunctionRunToolbar.tsx`
- Test: `packages/designer-ui/src/modules/function-run/components/FunctionRunToolbar.vitest.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FunctionRunToolbar } from './FunctionRunToolbar.js';

const base = {
  verbs: ['GET', 'POST'] as const,
  verb: 'GET' as const,
  onVerbChange: () => {},
  canInvoke: true,
  invokeDisabledReason: null,
  invoking: false,
  onInvoke: () => {},
  onOpenHeaders: () => {},
  scope: 'D' as const,
  workflowKey: '',
  instanceId: '',
  onScopeIdsChange: () => {},
};

const render = (over: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(FunctionRunToolbar, { ...base, ...over } as never));

describe('FunctionRunToolbar', () => {
  it('offers exactly the verbs it was given', () => {
    const html = render();
    expect(html).toContain('GET');
    expect(html).toContain('POST');
    expect(html).not.toContain('PATCH');
  });

  it('offers all four when the contract restricts nothing', () => {
    const html = render({ verbs: ['GET', 'POST', 'PATCH', 'DELETE'] });
    for (const verb of ['GET', 'POST', 'PATCH', 'DELETE']) expect(html).toContain(verb);
  });

  it('hides the instance fields for a domain-scoped function', () => {
    const html = render();
    expect(html).not.toContain('Workflow key');
    expect(html).not.toContain('Instance id');
  });

  it('asks for workflow and instance for F and I scopes', () => {
    for (const scope of ['F', 'I']) {
      const html = render({ scope });
      expect(html).toContain('Workflow key');
      expect(html).toContain('Instance id');
    }
  });

  it('states why Invoke is disabled rather than just disabling it', () => {
    // A disabled control with no explanation is the failure mode this guards.
    const html = render({ canInvoke: false, invokeDisabledReason: 'Enter an instance id to run this function.' });
    expect(html).toContain('Enter an instance id to run this function.');
    expect(html).toMatch(/<button[^>]*disabled/);
  });

  it('disables Invoke while a call is in flight', () => {
    expect(render({ invoking: true })).toMatch(/<button[^>]*disabled/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/function-run/components/FunctionRunToolbar.vitest.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Props:

```ts
import type { FunctionVerb, FunctionScope } from '@vnext-forge-studio/vnext-types';

export interface FunctionRunToolbarProps {
  verbs: readonly FunctionVerb[];
  verb: FunctionVerb | null;
  onVerbChange: (verb: FunctionVerb) => void;
  canInvoke: boolean;
  /** Shown next to a disabled Invoke; null when it is enabled. */
  invokeDisabledReason: string | null;
  invoking: boolean;
  onInvoke: () => void;
  onOpenHeaders: () => void;
  scope: FunctionScope;
  workflowKey: string;
  instanceId: string;
  onScopeIdsChange: (next: { workflowKey: string; instanceId: string }) => void;
}
```

Layout — one flex row, `flex flex-wrap items-center gap-2`, matching the toolbar density used in `FunctionEditorPanel`'s cards:

1. `<Select value={verb ?? ''} onChange={(e) => onVerbChange(e.target.value as FunctionVerb)} className="text-xs">` with one `<option>` per entry in `verbs`.
2. Invoke `<Button variant="secondary" disabled={!canInvoke || invoking} onClick={onInvoke}>` — label `Invoke` or `Invoking…`.
3. When `!canInvoke && invokeDisabledReason`, a `<span className="text-muted-foreground text-[10px]">{invokeDisabledReason}</span>` immediately after the button. **Never a silently disabled control.**
4. A `Headers` button (`variant="default"`, `onClick={onOpenHeaders}`) — the dialog itself is the shell's, not the toolbar's.
5. When `scope !== 'D'`, a second row: two `<Field label="Workflow key">` / `<Field label="Instance id">` wrapping `<Input size="sm">`, wired to `onScopeIdsChange`, plus a hint reading `A {scope}-scoped function runs against a workflow instance.`

The toolbar is presentational — it holds no state and owns no dialog.

- [ ] **Step 4: Verify** — 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/designer-ui/src/modules/function-run/components/FunctionRunToolbar.tsx packages/designer-ui/src/modules/function-run/components/FunctionRunToolbar.vitest.test.tsx
git commit -m "feat(function-run): toolbar"
```

---

### Task 14: Payload editor

**Files:**
- Create: `packages/designer-ui/src/modules/function-run/components/FunctionRunPayloadEditor.tsx`
- Test: `packages/designer-ui/src/modules/function-run/components/FunctionRunPayloadEditor.vitest.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// Monaco does not run under this test setup (no jsdom); the JSON editor is
// rendered by CopyableJsonBlock's sibling export.
vi.mock('../../quick-run/components/CopyableJsonBlock', () => ({
  JsonEditorWithCopy: () => null,
  CopyableJsonBlock: () => null,
}));

const { FunctionRunPayloadEditor } = await import('./FunctionRunPayloadEditor.js');

const base = {
  contentType: 'json' as const,
  onContentTypeChange: () => {},
  value: {},
  onChange: () => {},
  schema: null,
  verb: 'POST' as const,
};

const render = (over: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(FunctionRunPayloadEditor, { ...base, ...over } as never));

describe('FunctionRunPayloadEditor', () => {
  it('offers both content types the proxy allows', () => {
    const html = render();
    expect(html).toContain('application/json');
    expect(html).toContain('application/x-www-form-urlencoded');
  });

  it('renders key/value rows for form-urlencoded', () => {
    expect(render({ contentType: 'form', value: { a: '1' } })).toContain('a');
  });

  it('warns that GET and DELETE send no body, without disabling the editor', () => {
    for (const verb of ['GET', 'DELETE']) {
      const html = render({ verb });
      expect(html).toContain('query parameters');
    }
  });

  it('says nothing about query parameters for POST and PATCH', () => {
    for (const verb of ['POST', 'PATCH']) {
      expect(render({ verb })).not.toContain('query parameters');
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Implement**

```ts
export interface FunctionRunPayloadEditorProps {
  contentType: ContentTypeId;
  onContentTypeChange: (next: ContentTypeId) => void;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  /** From `inputSchema`, when the contract declares one. */
  schema: Record<string, unknown> | null;
  verb: FunctionVerb;
}
```

Behaviour:

- A `<Select>` of the two `CONTENT_TYPES` entries — label each with the media type itself, since that is what goes on the wire.
- `contentType === 'json' && schema` → `<SchemaForm schema={schema} objectValue={value} onObjectChange={onChange} showRawToggle jsonEditorRows={10} />`. Use the **object** arm of the union, not the string arm — the runner holds a `Record`, and round-tripping through a string loses type fidelity.
- `contentType === 'json' && !schema` → `<JsonEditorWithCopy value={JSON.stringify(value, null, 2)} onChange={…} rows={10} label="Payload (JSON)" />`. Parse on change; when the text is not valid JSON keep the last good object and surface the parse error under the editor rather than throwing.
- `contentType === 'form'` → key/value rows: an `<Input>` pair per entry plus add/remove buttons, producing a flat `Record<string, unknown>`. Nested values are not representable in form encoding; say so in a hint rather than silently flattening.
- When `verb` is `GET` or `DELETE`, render an inline note: `GET and DELETE send no body — these values are sent as query parameters.` **Do not disable the editor** — the values are still used, just as a query.

- [ ] **Step 4: Verify** — 4 tests pass.

- [ ] **Step 5: Commit** — `feat(function-run): payload editor`

---

### Task 15: Input pane

**Files:**
- Create: `packages/designer-ui/src/modules/function-run/functionRunView.ts` (+ colocated test)
- Create: `packages/designer-ui/src/modules/function-run/components/FunctionRunInputPane.tsx`
- Test: `packages/designer-ui/src/modules/function-run/components/FunctionRunInputPane.vitest.test.tsx`

- [ ] **Step 1: Write the failing test for the adapter**

`functionRunView.vitest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { toViewResponse } from './functionRunView';

describe('toViewResponse', () => {
  it('adapts a contract exchange into the shape PseudoUiOrJsonBlock needs', () => {
    const result = toViewResponse({
      status: 200,
      contentType: 'application/json',
      responseHeaders: {},
      body: '{"key":"branch-form","type":"pseudo-ui","content":{"component":"Column"}}',
      json: { key: 'branch-form', type: 'pseudo-ui', content: { component: 'Column' } },
    });
    expect(result?.key).toBe('branch-form');
    expect(result?.type).toBe('pseudo-ui');
    expect(result?.content).toEqual({ component: 'Column' });
  });

  it('returns null when the contract returned no content', () => {
    // `hasView: false`, or a 404 — "no contract right now" is not an error.
    expect(toViewResponse(null)).toBeNull();
    expect(
      toViewResponse({ status: 404, contentType: 'application/json', responseHeaders: {}, body: '' }),
    ).toBeNull();
  });

  it('returns null when the body was not parseable JSON', () => {
    expect(
      toViewResponse({
        status: 200, contentType: 'application/json', responseHeaders: {},
        body: 'not json', jsonParseError: 'Unexpected token',
      }),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Implement `toViewResponse`**

```ts
/**
 * Adapts a `functions/fetchContract` exchange into the `ViewResponse` that
 * `PseudoUiOrJsonBlock` consumes.
 *
 * Returns `null` rather than throwing for every "no view to show" case — a
 * non-2xx, an unparseable body, or a payload that is not a view. `/info`'s
 * `hasView` means "following this href returns content *now*", so an empty
 * result is an expected outcome, not a failure.
 */
export function toViewResponse(exchange: FunctionExchange | null): ViewResponse | null
```

Only a 2xx with a parsed object carrying a `content` field yields a `ViewResponse`. Carry `key`, `type`, `content`, and `renderer`/`display` through when present.

- [ ] **Step 3: Write the failing test for the pane**

```tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../quick-run/pseudo-ui/PseudoUiOrJsonBlock', () => ({
  PseudoUiOrJsonBlock: () => null,
}));
vi.mock('../../quick-run/components/CopyableJsonBlock', () => ({
  JsonEditorWithCopy: () => null,
  CopyableJsonBlock: () => null,
}));

const { FunctionRunInputPane } = await import('./FunctionRunInputPane.js');

const base = {
  mode: 'payload' as const,
  onModeChange: () => {},
  hasInputView: false,
  inputView: null,
  onViewFormChange: () => {},
  payloadEditorProps: {
    contentType: 'json' as const, onContentTypeChange: () => {},
    value: {}, onChange: () => {}, schema: null, verb: 'POST' as const,
  },
};

const render = (over: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(FunctionRunInputPane, { ...base, ...over } as never));

describe('FunctionRunInputPane', () => {
  it('always offers the Payload mode, even when a view exists', () => {
    // Free input must never be taken away — the whole point of the toggle.
    const html = render({ hasInputView: true, mode: 'view' });
    expect(html).toContain('Payload');
    expect(html).not.toMatch(/Payload<\/button>[^]*?disabled/);
  });

  it('disables the View mode with a reason when the contract declares none', () => {
    const html = render({ hasInputView: false });
    expect(html).toMatch(/<button[^>]*disabled/);
    expect(html).toContain('declares no input view');
  });

  it('marks the active mode for assistive technology', () => {
    expect(render({ mode: 'payload' })).toContain('aria-checked="true"');
  });
});
```

- [ ] **Step 4: Implement the pane**

```ts
export interface FunctionRunInputPaneProps {
  mode: RunMode;
  onModeChange: (next: RunMode) => void;
  hasInputView: boolean;
  inputView: ViewResponse | null;
  onViewFormChange: (data: Record<string, unknown>) => void;
  payloadEditorProps: FunctionRunPayloadEditorProps;
}
```

- A two-button `role="radiogroup"` toggle labelled `View` / `Payload`, copying the markup at `ViewBindingsSection.tsx:192-217` (`bg-muted flex gap-0.5 rounded-lg p-0.5`, each button `role="radio" aria-checked`, active gets `bg-surface text-foreground ring-border shadow-sm ring-1`).
- The **View** button is `disabled` with `title="This function declares no input view"` when `!hasInputView`. The **Payload** button is never disabled.
- `mode === 'view'` → `<PseudoUiOrJsonBlock view={inputView} jsonValue={inputView.content} displayContent="" ariaLabel="Function input view" integrationMode="simulation" panelStorageScope="function-run-input" onFormChange={onViewFormChange} />`. No `delegate` — the view is a form here, and submission is the toolbar's job (Task 12b is what makes this possible).
- `mode === 'payload'` → `<FunctionRunPayloadEditor {...payloadEditorProps} />`.

- [ ] **Step 5: Verify** — adapter tests + 3 pane tests pass.

- [ ] **Step 6: Commit** — `feat(function-run): input pane and contract-to-view adapter`

---

### Task 16: Response pane and authorization banner

**Files:**
- Create: `packages/designer-ui/src/modules/function-run/components/FunctionRunAuthzBanner.tsx`
- Create: `packages/designer-ui/src/modules/function-run/components/FunctionRunResponsePane.tsx`
- Test: `packages/designer-ui/src/modules/function-run/components/FunctionRunResponsePane.vitest.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../quick-run/pseudo-ui/PseudoUiOrJsonBlock', () => ({
  PseudoUiOrJsonBlock: () => null,
}))

const { FunctionRunResponsePane } = await import('./FunctionRunResponsePane.js')

const exchange = (over: Partial<Record<string, unknown>> = {}) => ({
  status: 200, contentType: 'application/json', responseHeaders: {}, body: '{}', ...over,
})

function render(props: Record<string, unknown>) {
  return renderToStaticMarkup(createElement(FunctionRunResponsePane, props as never))
}

describe('FunctionRunResponsePane', () => {
  it('shows the numeric status for a success', () => {
    expect(render({ response: exchange(), durationMs: 12 })).toContain('200')
  })

  it('shows an error status rather than hiding it', () => {
    // A function under development legitimately returns 5xx; the runner must
    // render it like any other response.
    const html = render({ response: exchange({ status: 500, body: 'boom', contentType: 'text/plain' }), durationMs: 5 })
    expect(html).toContain('500')
    expect(html).toContain('boom')
  })

  it('renders the authorization banner for 403', () => {
    expect(render({ response: exchange({ status: 403 }), durationMs: 3 }))
      .toContain('not allowed to run')
  })

  it('does not render the authorization banner for 404', () => {
    expect(render({ response: exchange({ status: 404 }), durationMs: 3 }))
      .not.toContain('not allowed to run')
  })

  it('lists response headers', () => {
    const html = render({
      response: exchange({ responseHeaders: { 'x-trace-id': 'trace-42' } }), durationMs: 1,
    })
    expect(html).toContain('x-trace-id')
    expect(html).toContain('trace-42')
  })

  it('renders nothing before the first invoke', () => {
    expect(render({ response: null, durationMs: null })).toBe('')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/function-run/components/FunctionRunResponsePane.vitest.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the banner**

```tsx
import { ShieldAlert } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '../../../ui/Alert';

/**
 * `/info` and invoke share one access policy in the runtime, so a 403 on
 * either means the same denial. Called out separately from other 4xx so the
 * user does not go looking for a bug in the function.
 */
export function FunctionRunAuthzBanner({ status }: { status: number }) {
  return (
    <Alert variant="warning" className="py-2">
      <ShieldAlert aria-hidden />
      <AlertTitle>You are not allowed to run this function ({status})</AlertTitle>
      <AlertDescription>
        The runtime refused with the current credentials. Check the function&apos;s{' '}
        <code className="font-mono text-[10px]">roles</code> and the auth headers in Headers —
        discovery and execution are gated by the same policy, so this is a permissions problem,
        not a broken function.
      </AlertDescription>
    </Alert>
  );
}
```

- [ ] **Step 4: Implement the response pane**

Requirements:

- Returns `null` when `response` is null.
- Status badge coloured by `classifyStatus`, with the numeric code and `durationMs` always visible.
- `isAuthorizationFailure(status)` → `FunctionRunAuthzBanner` above everything else.
- Headers section mirroring `ResponseHeadersSection` (`InstanceDashboard.tsx:809-830`): `x-trace-id` pinned with a copy button, the rest behind *Show N more headers*.
- Body: JSON content type → `CopyableJsonBlock` on `response.json ?? response.body`; otherwise a `<pre>` of `response.body`.
- When `outputViewContent` is present, a `View` / `Raw` toggle rendering `PseudoUiOrJsonBlock` above the raw body.

- [ ] **Step 5: Run to verify it passes**

```bash
pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/function-run/components/FunctionRunResponsePane.vitest.test.tsx
```

Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/designer-ui/src/modules/function-run/components/FunctionRunAuthzBanner.tsx packages/designer-ui/src/modules/function-run/components/FunctionRunResponsePane.tsx packages/designer-ui/src/modules/function-run/components/FunctionRunResponsePane.vitest.test.tsx
git commit -m "feat(function-run): response pane with explicit authorization surface"
```

---
### Task 17: `FunctionRunShell`

The shell is pure orchestration, which is the most defect-prone part of this feature — and the part this package's test style cannot reach. There is no jsdom, so `renderToStaticMarkup` never runs effects: a render test sees only the initial state and can never observe a fetch, a state transition, or an error mapping.

So the decisions come out of the component into a pure module, exactly as `functionContractSlots`, `functionRunPayload` and `functionRunView` already do. The component keeps only wiring.

**Files:**
- Create: `packages/designer-ui/src/modules/function-run/functionRunOrchestration.ts` + `.vitest.test.ts`
- Create: `packages/designer-ui/src/modules/function-run/FunctionRunShell.tsx` + `.vitest.test.tsx`
- Create: `packages/designer-ui/src/modules/function-run/index.ts`
- Modify: `packages/designer-ui/src/index.ts` (export the module)

#### Decisions already settled — do not relitigate

- The runner owns Invoke. The input view is a form; its values arrive via `onFormChange`. **No `delegate`** is passed to the input view.
- Payload mode is always reachable; View mode is what gets disabled, with a stated reason.
- A disabled control always states why.
- Scope `D` runs immediately; `F`/`I` need a manually entered workflow key and instance id before Invoke is enabled.
- Every request's headers go through `mergeQuickRunHeaders` — never an ad-hoc spread. The workflow runner has ~20 direct spreads that drifted from the helper and caused a real bug; this module does not repeat that.

#### Where headers come from, for now

Task 19 adds the tool-wide header source (extension context message, web store). It has not run yet. So **this task takes `toolWideHeaders` as an optional prop** and passes it as `mergeQuickRunHeaders`'s fourth argument. Task 19 supplies the real value from the host. Do not build the store here.

- [ ] **Step 1: Write the failing test for the orchestration**

`functionRunOrchestration.vitest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { computeInvokeGate, readInfoExchange } from './functionRunOrchestration';

const exchange = (over: Partial<Record<string, unknown>> = {}) => ({
  status: 200, contentType: 'application/json', responseHeaders: {}, body: '{}', ...over,
}) as never;

const INFO = {
  key: 'get-branches', domain: 'core', version: '1.0.0', scope: 'D',
  function: { verbs: ['GET'], href: '/core/functions/get-branches' },
};

describe('readInfoExchange', () => {
  it('parses a 200 into info', () => {
    const result = readInfoExchange(exchange({ json: INFO }));
    expect(result.info).toEqual(INFO);
    expect(result.error).toBeNull();
  });

  it('explains a 404 as a missing component, not a failure', () => {
    // Built-in system functions (state, view, data…) have no sys-functions
    // component and legitimately 404 from /info.
    const result = readInfoExchange(exchange({ status: 404, json: {} }));
    expect(result.info).toBeNull();
    expect(result.error).toMatch(/no sys-functions component/i);
  });

  it('explains a 403 as a permissions problem', () => {
    const result = readInfoExchange(exchange({ status: 403, json: { detail: 'forbidden' } }));
    expect(result.info).toBeNull();
    expect(result.error).toMatch(/not allowed/i);
  });

  it('reports any other non-2xx with its status', () => {
    const result = readInfoExchange(exchange({ status: 500, body: 'boom', contentType: 'text/plain' }));
    expect(result.info).toBeNull();
    expect(result.error).toContain('500');
  });

  it('reports a 200 whose body is not a usable info payload', () => {
    // A 200 that does not carry `function.href` cannot drive the runner.
    expect(readInfoExchange(exchange({ json: { key: 'x' } })).error).toMatch(/could not be read/i);
    expect(readInfoExchange(exchange({ body: 'not json', jsonParseError: 'x' })).error).toMatch(/could not be read/i);
  });
});

describe('computeInvokeGate', () => {
  it('allows a domain-scoped function as soon as info is loaded', () => {
    expect(computeInvokeGate({ info: INFO as never, scope: 'D', workflowKey: '', instanceId: '' }))
      .toEqual({ canInvoke: true, reason: null });
  });

  it('blocks before info has loaded, and says why', () => {
    const gate = computeInvokeGate({ info: null, scope: 'D', workflowKey: '', instanceId: '' });
    expect(gate.canInvoke).toBe(false);
    expect(gate.reason).toMatch(/contract/i);
  });

  it('names the missing field for F and I scopes', () => {
    for (const scope of ['F', 'I'] as const) {
      expect(computeInvokeGate({ info: INFO as never, scope, workflowKey: '', instanceId: 'i' }).reason)
        .toMatch(/workflow key/i);
      expect(computeInvokeGate({ info: INFO as never, scope, workflowKey: 'w', instanceId: '' }).reason)
        .toMatch(/instance id/i);
      expect(computeInvokeGate({ info: INFO as never, scope, workflowKey: 'w', instanceId: 'i' }))
        .toEqual({ canInvoke: true, reason: null });
    }
  });

  it('treats whitespace-only scope ids as missing', () => {
    expect(computeInvokeGate({ info: INFO as never, scope: 'F', workflowKey: '  ', instanceId: 'i' }).canInvoke)
      .toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/function-run/functionRunOrchestration.vitest.test.ts
```

- [ ] **Step 3: Implement the orchestration**

```ts
export interface InfoReadResult {
  info: FunctionInfo | null;
  /** User-facing explanation when `info` is null. */
  error: string | null;
}

/**
 * Maps an `/info` exchange onto what the runner shows.
 *
 * Each non-2xx gets its own sentence because they mean genuinely different
 * things and send the user to different places: a 403 is a permissions
 * problem (discovery and execution share one access policy), a 404 means the
 * key has no `sys-functions` component at all — which is the expected answer
 * for a built-in system function like `state` or `view`.
 */
export function readInfoExchange(exchange: FunctionExchange): InfoReadResult;

export interface InvokeGate {
  canInvoke: boolean;
  /** Non-null exactly when `canInvoke` is false. Shown next to the button. */
  reason: string | null;
}

/**
 * Whether Invoke is enabled, and if not, which specific thing is missing.
 *
 * Names the field rather than saying "incomplete" — a disabled control with
 * no explanation is the failure mode this whole surface is designed against.
 */
export function computeInvokeGate(input: {
  info: FunctionInfo | null;
  scope: FunctionScope;
  workflowKey: string;
  instanceId: string;
}): InvokeGate;
```

A payload counts as usable info only when it is an object carrying `function.href`.

- [ ] **Step 4: Implement the shell**

```ts
export interface FunctionRunShellProps {
  domain: string;
  functionKey: string;
  scope: FunctionScope;
  runtimeUrl?: string;
  projectId?: string;
  /** Forge-wide headers. Task 19 supplies these from the host. */
  toolWideHeaders?: Record<string, string>;
}
```

Wiring:

1. **Load `/info`** on mount, and again whenever `scope !== 'D'` and both scope ids are non-empty. Feed the exchange through `readInfoExchange` into the store.
2. **On info:** `verb = defaultVerbFor(resolveVerbs(info.function.verbs))`. If `info.inputView?.hasView`, `fetchContract(info.inputView.href)` → `toViewResponse` → store. Same for `info.inputSchema?.hasSchema` → the parsed schema object.
3. **Invoke:** `buildInvokeRequest({verb, mode, viewFormData, payload, contentType})` → `FunctionRunApi.invoke({path: info.function.href, verb, ...request, headers})`. Time it for `responseDurationMs`. Afterwards, if `info.outputView?.hasView`, fetch and adapt the output view.
4. **Headers:** one helper, `mergeQuickRunHeaders(null, sessionHeaders, undefined, toolWideHeaders)`, used for `/info`, both contract fetches, and invoke. The first argument is `null` — a function run has no per-workflow bucket.
5. **Own the `HeadersConfigDialog`.** The toolbar only signals `onOpenHeaders`. `HeaderEntry` is not exported, so build the array inline as `{name, value}[]` and keep session headers in local state.
6. **Empty state.** `FunctionRunResponsePane` renders nothing before the first invoke, so the shell shows its own placeholder — "Pick a verb and choose Invoke to run this function." — in the response column.
7. **`infoError`** renders in place of the input pane: without a contract there is nothing meaningful to fill in.

Layout: two columns on wide viewports (input | response), stacked below, inside the block layout the sibling editors use (`space-y-4 p-4`).

- [ ] **Step 5: Write the shell render test**

Effects do not run under SSR, so this covers the *initial* render only — the orchestration tests above are what cover the logic. Assert only what is true before any fetch resolves.

```tsx
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../quick-run/pseudo-ui/PseudoUiOrJsonBlock', () => ({ PseudoUiOrJsonBlock: () => null }));
vi.mock('../quick-run/components/CopyableJsonBlock', () => ({
  CopyableJsonBlock: () => null, JsonEditorWithCopy: () => null,
}));
vi.mock('./FunctionRunApi', () => ({
  getInfo: vi.fn().mockResolvedValue({ success: true, data: { status: 200, contentType: 'application/json', responseHeaders: {}, body: '{}', json: {} } }),
  fetchContract: vi.fn(),
  invoke: vi.fn(),
}));

const { FunctionRunShell } = await import('./FunctionRunShell.js');

const render = (over: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    createElement(FunctionRunShell, { domain: 'core', functionKey: 'get-branches', scope: 'D', ...over } as never),
  );

const disabledCount = (html: string) => (html.match(/ disabled=""/g) ?? []).length;

describe('FunctionRunShell', () => {
  it('asks for workflow and instance when the function is not domain-scoped', () => {
    const html = render({ scope: 'F' });
    expect(html).toContain('Workflow key');
    expect(html).toContain('Instance id');
  });

  it('does not ask for them for a domain-scoped function', () => {
    expect(render()).not.toContain('Instance id');
  });

  it('disables Invoke before the contract has loaded, and says why', () => {
    // Effects have not run, so /info has not resolved — exactly the state a
    // user sees for the first moment, and it must not be a bare grey button.
    const html = render();
    expect(disabledCount(html)).toBeGreaterThan(0);
    expect(html).toMatch(/contract/i);
  });

  it('shows a placeholder instead of an empty response column', () => {
    expect(render()).toMatch(/Invoke to run this function/i);
  });
});
```

- [ ] **Step 6: Mutation-check**

Break each of these and confirm a test fails, then restore: the F/I field gating, the invoke-disabled reason, the placeholder. Report the results — an assertion that cannot fail is worse than none.

- [ ] **Step 7: Barrel and package export**

```ts
export { FunctionRunShell, type FunctionRunShellProps } from './FunctionRunShell';
export { useFunctionRunStore } from './store/functionRunStore';
export * as FunctionRunApi from './FunctionRunApi';
```

Add the module to `packages/designer-ui/src/index.ts` following how the sibling modules are exported.

- [ ] **Step 8: Verify and commit**

```bash
pnpm --filter @vnext-forge-studio/designer-ui exec vitest run
pnpm --filter @vnext-forge-studio/designer-ui exec tsc --noEmit -p tsconfig.json
pnpm exec eslint packages/designer-ui/src/modules/function-run
```

```bash
git commit -m "feat(function-run): shell assembly with testable orchestration"
```

---

# Phase D — Hosts

### Task 18: In-editor Run panel

**Files:**
- Modify: `packages/designer-ui/src/modules/function-editor/FunctionEditorView.tsx`

- [ ] **Step 1: Implement**

- Add `const [runOpen, setRunOpen] = useState(false)`.
- Register a **Run** toolbar action through the existing `registerToolbar` slot, toggling `runOpen`.
- When `runOpen`, render `<FunctionRunShell domain={...} functionKey={...} scope={...} projectId={id} />` in the `FlowEditorCanvasAndScriptResizableColumn`'s second slot — the same column the script panel uses.
- Read `domain` / `functionKey` / `scope` from `componentJson` (`json.domain`, `json.key`, `json.attributes.scope`), defaulting scope to `'I'` to match `toFunctionMetadataFormValues`.
- Do **not** offer Run when `layoutSurface === 'modal'`: `ComponentEditorDialog` exists to edit a referenced component, not to run it.

- [ ] **Step 2: Verify the editor still typechecks and its tests pass**

```bash
pnpm --filter @vnext-forge-studio/designer-ui exec tsc --noEmit && pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/function-editor
```

Expected: no tsc output; all function-editor tests green.

- [ ] **Step 3: Commit**

```bash
git add packages/designer-ui/src/modules/function-editor/FunctionEditorView.tsx
git commit -m "feat(function-editor): Run panel"
```

---

### Task 19: Tool-wide headers plumbing

**Files:**
- Modify: `apps/extension/src/panels/QuickRunPanel.ts` (context message), `apps/extension/src/panels/DesignerPanel.ts` (context message)
- Create: `apps/web/src/app/store/useToolHeadersStore.ts`
- Modify: consumers to pass `toolWide` into `mergeQuickRunHeaders`

- [ ] **Step 1: Forward the existing setting**

`forge-tools-settings.ts` already persists `QuickRunSettings.globalHeaders` (line 111) and exposes it through the async `loadQuickRunSettings()` (line 480, memoised in `quickRunCache`). `QuickRunPanel.sendContextWithPolling` (line 204) already awaits it but reads only `polling.*`. Extend that existing block — do **not** add a second settings read:

```ts
  private async sendContextWithPolling(entry: PanelEntry, ctx: QuickRunContext): Promise<void> {
    let pollingRetryCount: number | undefined;
    let pollingIntervalMs: number | undefined;
    let globalHeaders: Record<string, string> | undefined;
    if (this.forgeToolsSettings) {
      const qr = await this.forgeToolsSettings.loadQuickRunSettings();
      pollingRetryCount = qr.polling.retryCount;
      pollingIntervalMs = qr.polling.intervalMs;
      // Forge-wide headers. Persisted since the settings file was introduced
      // but never forwarded, so the UI has never seen them.
      globalHeaders = Object.fromEntries(qr.globalHeaders.map((h) => [h.name, h.value]));
    }
    void entry.panel.webview.postMessage({
      type: 'quickrun:context',
      ...ctx,
      pollingRetryCount,
      pollingIntervalMs,
      globalHeaders,
    });
  }
```

`DesignerPanel` needs the same headers for the in-editor runner. It has no equivalent method, so add one modelled on the block above and include `globalHeaders` in the config it injects as `window.__VNEXT_CONFIG__` (`buildWebviewConfig`), since `DesignerPanel` passes context that way rather than by a `*:context` message.

- [ ] **Step 2: Add the web store**

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ToolHeadersState {
  headers: Record<string, string>;
  setHeaders: (headers: Record<string, string>) => void;
}

/** Forge-wide headers shared by the workflow and function runners. */
export const useToolHeadersStore = create<ToolHeadersState>()(
  persist(
    (set) => ({ headers: {}, setHeaders: (headers) => set({ headers }) }),
    { name: 'vnext-forge-tool-headers' },
  ),
);
```

- [ ] **Step 3: Pass the layer through**

Both `FunctionRunShell` and `QuickRunShell` read the tool-wide headers and pass them as the fourth `mergeQuickRunHeaders` argument.

- [ ] **Step 4: Verify and commit**

```bash
pnpm --filter @vnext-forge-studio/designer-ui exec vitest run src/modules/quick-run
git add apps/extension/src/panels apps/web/src/app/store/useToolHeadersStore.ts packages/designer-ui/src
git commit -m "feat(quick-run): forward tool-wide headers into both runners"
```

---

### Task 20: Standalone web surface

**Files:**
- Create: `apps/web/src/pages/function-run/FunctionRunPage.tsx`
- Modify: `apps/web/src/app/AppRouter.tsx`, `apps/web/src/modules/project-workspace/editorTabNavigation.ts`

- [ ] **Step 1: Implement**

Mirror `apps/web/src/pages/quickrun/QuickRunPage.tsx`: read `:id/:group/:name`, load the function JSON to get `domain` / `key` / `attributes.scope`, then render `FunctionRunShell`. Add the lazy route `function-run/:group/:name` and a `functionrun` tab kind.

- [ ] **Step 2: Build and commit**

```bash
pnpm --filter @vnext-forge-studio/web build
git add apps/web/src
git commit -m "feat(web): standalone Function Quick Runner route"
```

---

### Task 21: Standalone extension surface

**Files:**
- Create: `apps/extension/src/panels/FunctionQuickRunPanel.ts`
- Modify: `apps/extension/src/extension.ts`, `apps/extension/package.json`, `apps/extension/src/tools/providers/quickrun-provider.ts`
- Create: `apps/extension/webview-ui/src/functionrun-main.tsx` + app component

- [ ] **Step 1: Implement**

Mirror `QuickRunPanel` exactly, including the CSP block (`frame-src 'self'`, tenant style source, `worker-src blob:`) — pseudo-ui will not render without it. Add `vnextForge.openFunctionQuickRun` (QuickPick over `**/Functions/**/*.json`) and `openFunctionQuickRunFromFile`, contribute both in `package.json`, and add a Forge Tools tree entry.

- [ ] **Step 2: Build and commit**

```bash
pnpm --filter vnext-forge-studio exec tsc --noEmit && pnpm --filter vnext-forge-studio build
git add apps/extension
git commit -m "feat(extension): standalone Function Quick Runner panel and command"
```

---

# Phase E — Verification

### Task 22: Full verification

- [ ] **Step 1: Run every affected suite**

```bash
pnpm --filter @vnext-forge-studio/services-core exec vitest run && pnpm --filter @vnext-forge-studio/designer-ui exec vitest run
```

Expected: all green. designer-ui was at 531 tests before this plan; expect ~+40.

- [ ] **Step 2: Typecheck every consumer**

```bash
for p in "@vnext-forge-studio/services-core" "@vnext-forge-studio/designer-ui" "@vnext-forge-studio/web" "@vnext-forge-studio/monitoring" "vnext-forge-studio"; do
  printf "%-38s" "$p"; pnpm --filter "$p" exec tsc --noEmit >/dev/null 2>&1 && echo "tsc OK" || echo "tsc FAIL"
done
```

Expected: all `tsc OK`.

- [ ] **Step 3: Build**

```bash
pnpm --filter @vnext-forge-studio/web build && pnpm --filter vnext-forge-studio build
```

Expected: both succeed.

- [ ] **Step 4: Lint the new files**

```bash
pnpm exec eslint packages/services-core/src/services/function-run packages/designer-ui/src/modules/function-run
```

Expected: no output. (Per-package `eslint .` is pre-existing red across this repo — lint only what this plan touched.)

- [ ] **Step 5: Manual end-to-end against a running runtime**

```bash
pnpm --filter @vnext-forge-studio/web build && pnpm --filter vnext-forge-studio dev
```

Checklist:
1. Open a domain-scoped function → Run → `/info` fires, verb selector shows the declared verbs.
2. A function with no `verbs` → all four offered.
3. Input view present → renders; Payload toggle still reachable.
4. No input view → Payload mode is the default and the View button is disabled with a reason.
5. `POST` + form-urlencoded → the request carries `application/x-www-form-urlencoded` (check the runtime log).
6. `GET` with payload values → they arrive as query parameters, no body.
7. Non-2xx (point at a function that throws) → status badge and body render; **no** generic error.
8. A function whose roles exclude the caller → 403 banner, worded as a permissions problem.
9. Output view present → renders above the raw body, toggleable.
10. Response headers section shows `x-trace-id` with copy.
11. `F`-scoped function → Invoke disabled until workflow key + instance id are filled; then it runs.
12. A header added in Headers appears on both `/info` and invoke.

- [ ] **Step 6: Commit any fixes and open the PR**

```bash
git add -A && git commit -m "fix(function-run): manual verification follow-ups"
git push -u origin f/function-quick-runner
```

---

## Self-review notes

Spec coverage checked section by section: §1 → Tasks 3–6; §1.1/§1.2 → Task 2; §1.3 → Task 4; §2 → Task 1; §3.1 → Task 17; §3.2 → Tasks 14–15; §3.3 → Task 16; §4 → Tasks 2, 7, 8, 9; §5 → Tasks 10, 19; §6 → Tasks 18, 20, 21; §7 → Tasks 16, 17; §8 → every task's test step plus Task 22.

Naming is consistent across tasks: `buildInvokeRequest`, `resolveVerbs`, `defaultVerbFor`, `classifyStatus`, `isAuthorizationFailure`, `buildFunctionInfoPath`, `isValidRuntimePath`, `createFunctionRunService`, `FunctionExchange`, `FunctionInfo`.

Tasks 13, 14, 15, 18, 20 and 21 specify behaviour and the precedent file to copy rather than full component source. That is deliberate: those components are close mirrors of existing ones (`ViewBindingsSection`'s mode toggle, `ResponseHeadersSection`, `QuickRunPage`, `QuickRunPanel`), and transcribing hundreds of lines of near-duplicate JSX into the plan would go stale against the originals. Every one names its exact precedent with line numbers where it matters. Tasks with non-obvious logic — the ones where a mistake is silent — carry complete code and tests.
