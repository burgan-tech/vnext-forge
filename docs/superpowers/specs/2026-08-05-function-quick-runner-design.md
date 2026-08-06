# Function Quick Runner (Faz 2)

**Date:** 2026-08-05
**Status:** Approved

## Context

Forge has a Quick Runner for workflows: a simulation surface where a developer starts an instance, fires transitions, sees the rendered view, and inspects state. Functions have no equivalent — the only way to exercise one is an external HTTP client, with no view rendering and no schema help.

vNext PR [burgan-tech/vnext#868](https://github.com/burgan-tech/vnext/pull/868) makes a proper runner possible. It adds six discovery endpoints so a client can ask a function *what it is* before calling it:

```
{domain}/functions/{fn}/info
{domain}/functions/{fn}/view|schema?target=input|output
{domain}/workflows/{wf}/instances/{id}/functions/{fn}/info
{domain}/workflows/{wf}/instances/{id}/functions/{fn}/view|schema?target=input|output
```

`/info` answers *may I run this, with which verb, at which URL, and which view/schema applies right now*, in hyperlink style:

```json
{
  "key": "get-branches", "domain": "core", "version": "1.0.0", "scope": "D",
  "function": { "verbs": ["GET", "POST"], "href": "/core/functions/get-branches" },
  "rawResponse": true, "cacheable": false,
  "inputView":    { "hasView": true,   "loadData": false, "href": "/core/functions/get-branches/view?target=input" },
  "outputView":   { "hasView": true,   "loadData": false, "href": "/core/functions/get-branches/view?target=output" },
  "inputSchema":  { "hasSchema": true, "href": "/core/functions/get-branches/schema?target=input" },
  "outputSchema": { "hasSchema": true, "href": "/core/functions/get-branches/schema?target=output" }
}
```

Faz 1 (PR #63) gave the designer the editors for `verbs` / `inputView` / `outputView` / `inputSchema` / `outputSchema`. Faz 2 makes those declarations *executable* from inside Forge.

### Outcome

Open a function, switch to Run, and: see the verbs it accepts, fill its input view (or a raw payload), invoke it, and read the response — status, headers, body, and the output view — without leaving Forge. Authorization failures are stated plainly rather than surfacing as a generic error.

---

## Decisions taken during design

| Question | Decision |
|---|---|
| Scope F/I needs a workflow + instance | Scope `D` fully supported. `F`/`I` take a **manually entered** workflow key + instance id; Invoke is disabled with a stated reason until both are present. Instance picker deferred to Faz 3. |
| Where the runner lives | **Both** — one shared core component, mounted as a panel inside the function editor *and* as a standalone surface (web route + VS Code panel + command + Forge Tools tree entry). |
| Global headers | **Tool-wide**, read by the workflow runner too. Closes an existing gap (see §5). |
| What triggers invoke | The **runner** owns the verb selector and the Invoke button. The input view is a form; its submit action calls the same invoke path. |

---

## 1. Backend shape: follow the hypermedia

`/info` is deliberately hyperlink-style, so the client builds only the *first* URL (from scope) and follows `href`s for everything else. Three methods, rather than one per endpoint:

```
functions/getInfo        { domain, functionKey, scope, workflowKey?, instanceId? }
functions/fetchContract  { path }                       // view or schema — target is already in the href
functions/invoke         { path, verb, body?, contentType?, query? }
```

All three also take `headers?` and `runtimeUrl?`, matching every `quickrun/*` params type.

Rejected alternatives:

- **One method per endpoint** (`getInputView`, `getOutputSchema`, …) — spreads route construction across six client call sites when `target=input|output` is already encoded in the href.
- **Extending `quickrun/*`** — its params are built around `workflowIdentifier + instanceId`, both required. A domain-scoped function has neither.

### 1.1 Only the first path is constructed

`buildFunctionInfoPath` is a pure function, the single place that knows the scope→route rule:

```
scope 'D'        → /api/v1/{domain}/functions/{fn}/info
scope 'F' | 'I'  → /api/v1/{domain}/workflows/{wf}/instances/{id}/functions/{fn}/info
```

The domain route rejects `F`/`I` with 403, so sending an F/I function there would produce a misleading authorization error. The rule lives in one tested function for that reason.

### 1.2 `href` validation

`hrefs` come from the engine, but `functions/fetchContract` and `functions/invoke` accept a path parameter, so it is validated before use — runtime-relative only:

- must start with `/`
- must match `^/[A-Za-z0-9._~\-/]*(\?[A-Za-z0-9._~\-/=&%]*)?$` (no scheme, no `//host`, no fragment)
- must not contain `..`
- must contain `/functions/`

A rejection is `API_FORBIDDEN` with the offending path in `details`. This is defence in depth: `runtime-proxy` already pins the origin to an allowlisted base URL, so a bad path cannot reach another host.

### 1.3 Non-2xx is data, not an exception

This is the central difference from `quickrun/*`. `parseJsonResponse` in `quickrun.service.ts` throws `RUNTIME_EXECUTION_FAILED` on any non-2xx, burying the status in `error.details.httpStatus`. A function under development legitimately returns 4xx/5xx, and the runner must show that plainly.

All three `functions/*` methods therefore **always resolve**, returning the raw exchange:

```ts
{
  status: number,                              // 200, 403, 500 — as received
  contentType: string,
  responseHeaders: Record<string, string>,
  body: string,                                // raw; the UI parses per contentType
  json?: unknown,                              // parsed when contentType is JSON and parsing succeeds
}
```

Only transport failures still reject (`RUNTIME_CONNECTION_FAILED` from `runtime-proxy`) — there is no HTTP exchange to report in that case.

`runtimeProxyResult` already carries `{status, contentType, data, responseHeaders}`, so the material exists; these methods stop discarding it.

### 1.4 Registration checklist

Per `.cursor/rules/rpc-method-policy.mdc`:

- `packages/services-core/src/services/function-run/function-run.service.ts` + `function-run-schemas.ts`
- registry entries in `method-registry.ts`
- `policy.ts` → `privileged` for all three (they proxy to the runtime engine, same as `quickrun/*`)
- `packages/app-contracts/src/method-http.ts` → `MethodId` + `{verb: 'POST', paramSource: 'json'}` for all three
- `apps/server/src/api/v1/functions.routes.ts` via `createDispatchHelper`
- fixtures under `packages/services-core/test/fixtures/functions/`
- typed wrapper in `apps/web/src/services/` for web callers

The `functions/*` namespace is free — only `vnext/functions/list` exists today.

---

## 2. `runtime-proxy`: allow form-urlencoded

Functions accept JSON **or** `application/x-www-form-urlencoded`, so the runner must be able to send both. Today it cannot:

```ts
// runtime-proxy.service.ts:77-87 — Content-Type is set AFTER callerHeaders,
// so a caller-supplied value is overwritten.
const headers = { 'User-Agent': …, Accept: …, ...stripHopByHopHeaders(params.callerHeaders) }
if (sendsEntityBody) headers['Content-Type'] = 'application/json'
```

Change: when the caller supplied a `Content-Type` **and it is on a narrow allowlist**, honour it; otherwise keep today's behaviour.

```ts
const RUNTIME_PROXY_ALLOWED_REQUEST_CONTENT_TYPES = [
  'application/json',
  'application/x-www-form-urlencoded',
] as const
```

Unrecognized values fall back to `application/json` rather than erroring — this is a shared, security-relevant module and the conservative default is the safe one. Absent Content-Type behaves exactly as before, so no existing caller changes.

Body encoding stays in the caller: `functions/invoke` receives an already-encoded `body` string plus the `contentType` to declare. Encoding a key/value map into `a=1&b=2` is a pure UI-side function (§4.2), which keeps the proxy free of payload semantics.

---

## 3. Client module: `packages/designer-ui/src/modules/function-run/`

One core component, `FunctionRunShell`, with the host wrappers kept thin.

```
function-run/
  FunctionRunShell.tsx            core surface (toolbar + input + response)
  FunctionRunApi.ts               callApi wrappers over functions/*
  functionRunPaths.ts             buildFunctionInfoPath, isValidRuntimePath
  functionRunVerbs.ts             resolveVerbs, defaultVerbFor
  functionRunPayload.ts           buildInvokeRequest, decodeBodyForDisplay, CONTENT_TYPES
  functionRunStatus.ts            classifyStatus, isAuthorizationFailure
  types/functionRun.types.ts      FunctionInfo and response types
  components/
    FunctionRunToolbar.tsx        verb selector, Invoke, Headers, F/I instance fields
    FunctionRunInputPane.tsx      View | Payload toggle
    FunctionRunPayloadEditor.tsx  content-type selector + JSON / form editor
    FunctionRunResponsePane.tsx   status, headers, body, output view
    FunctionRunAuthzBanner.tsx    explicit 403 surface
  store/functionRunStore.ts       per-surface run state
```

### 3.1 Flow

1. On open (or when scope inputs complete for `F`/`I`): `functions/getInfo`.
2. `info.function.verbs` populates the verb selector; **absent or empty → all four** (`GET`, `POST`, `PATCH`, `DELETE`), per the contract's "no verb restriction" semantics.
3. `inputView.hasView` → `functions/fetchContract(inputView.href)` → render.
   `inputSchema.hasSchema` → `functions/fetchContract(inputSchema.href)` → drive `SchemaForm`.
   `has*` means "following the href returns content **now**" — a rule may match on a later call, so a `false` is not cached as "never".
4. Invoke → `functions/invoke({ path: info.function.href, verb, body, contentType, query })`.
5. Response pane renders; if `outputView.hasView`, fetch and render the output view with the response body as its data.

### 3.2 Input pane

`[ View | Payload ]` toggle. **Both are always reachable**, including when a view exists — the free payload editor is never hidden.

- **View** — `PseudoUiOrJsonBlock` → `PseudoUiViewSurface`, exactly as the workflow runner renders a state view. The view is a *form*: `onFormChange` lifts `formData` into the runner. Its submit action routes to the same invoke path, so there is one send path, not two.
- **Payload** — content-type selector (`application/json` | `application/x-www-form-urlencoded`), then:
  - JSON + `inputSchema` present → `SchemaForm` (which already has a Form ⇄ JSON toggle)
  - JSON, no schema → raw JSON editor (`JsonEditorWithCopy`)
  - form-urlencoded → key/value rows, encoded by `buildInvokeRequest`

The active mode's payload is what gets sent.

GET and DELETE carry no body: the payload becomes `query`. The pane says so rather than silently dropping input.

### 3.3 Response pane

- **Status** — prominent badge, coloured by class (2xx / 3xx / 4xx / 5xx) with the numeric code always visible, plus elapsed time. Every response is shown, including error statuses; a failed function call is a normal outcome here.
- **403** — its own banner via `FunctionRunAuthzBanner`, stating that the runtime refused execution for the current credentials, and that `/info` and invoke share one `IFunctionAccessPolicy` (so a 403 on discovery means the same denial). Distinguished from "wrong scope/route" so the user is not sent looking for the wrong bug.
- **Headers** — same treatment as the workflow runner's `ResponseHeadersSection`: `x-trace-id` pinned with copy, prominent set, rest collapsed.
- **Body** — raw, rendered per `contentType`: JSON pretty-printed in `CopyableJsonBlock`, anything else as plain text. A raw/pretty toggle for JSON.
- **Output view** — when `outputView.hasView`, rendered above the raw body with a toggle, using the same pseudo-ui surface.

### 3.4 Reused as-is

`mergeQuickRunHeaders`, `HeadersConfigDialog`, `SchemaForm` + `validateAgainstSchema`, `CopyableJsonBlock` / `JsonEditorWithCopy`, `ValidationErrorBlock`, `parseValidationFailure`, `PseudoUiOrJsonBlock` / `PseudoUiViewSurface` / `ViewModeToggle`, `createQuickRunPseudoDelegate` (adapted: the function runner's delegate handles `submit` → invoke instead of → fireTransition).

---

## 4. Pure logic, extracted for testing

The house pattern (`applyCacheMutation`, `mergeQuickRunHeaders`, `functionContractSlots`) is to keep decisions in pure functions and test those rather than rendering.

| Function | Rule |
|---|---|
| `buildFunctionInfoPath(scope, ids)` | scope→route; throws when `F`/`I` lacks workflow/instance |
| `isValidRuntimePath(path)` | §1.2 validation |
| `resolveVerbs(info)` | `verbs` when non-empty, else all four |
| `defaultVerbFor(verbs)` | prefer `GET`, else first |
| `buildInvokeRequest({verb, mode, viewFormData, payload, contentType})` | The whole request decision in one place: which pane's data is sent, whether it becomes a `body` or a `query`, and how it is encoded. Returns `{ body?, contentType?, query? }`. |
| `classifyStatus(status)` | `'success' \| 'redirect' \| 'client-error' \| 'server-error'` |
| `isAuthorizationFailure(status)` | `403` (and `401`) → dedicated banner |

`buildInvokeRequest` is deliberately one function rather than a `selectPayload` + `encodeBody` pair: the three decisions are coupled (a GET never carries a body regardless of content-type; form-urlencoded and JSON encode the same map differently), and splitting them invites a call site that encodes a body for a verb that cannot send one.

---

## 5. Global headers: tool-wide, and the gap it closes

`forge-tools-settings.ts` already defines `QuickRunSettings.globalHeaders` and persists it to `quickrun-settings.json` — but `QuickRunPanel.sendContextWithPolling` forwards only `polling.*`, so those headers reach no UI. The headers the workflow runner actually uses come from per-workflow `WorkflowBucketConfig.globalHeaders`.

Faz 2 wires the tool-wide set through and gives `mergeQuickRunHeaders` a fourth, lowest-priority layer:

```
toolWide → bucketConfig.globalHeaders → sessionHeaders → extra
```

- Extension: `QuickRunPanel` and the new `FunctionQuickRunPanel` both forward `globalHeaders` in their context message; the designer webview receives it too (for the in-editor runner).
- Web: a persisted zustand store alongside `useQuickRunSettingsStore`.
- The workflow runner reads the new layer as well, so one auth token entered once applies everywhere. Per-workflow headers keep overriding it, so no existing setup changes behaviour.

Both `/info` and invoke carry the merged headers, as do the contract fetches.

**Every** function-run request goes through `mergeQuickRunHeaders`. The workflow runner has ~20 direct `{...globalHeaders, ...sessionHeaders}` spreads that drifted from the helper and caused a real bug (documented in `createQuickRunPseudoDelegate.vitest.test.ts:150`); the new module does not repeat that.

---

## 6. Hosts

**In-editor panel.** `FunctionEditorView` gains a toolbar toggle that opens `FunctionRunShell` in the resizable column already used by the script panel. The editor has resolved `key`, `domain`, `scope`, `projectId` and the environment, so nothing extra is plumbed. `DesignerPanel`'s CSP was verified to match `QuickRunPanel`'s in every directive pseudo-ui needs (`frame-src 'self'`, tenant style source, `worker-src blob:`), so the shadow-DOM view renders there unchanged.

The runner is **not** offered when the function is opened as a nested modal (`ComponentEditorDialog`) — that surface exists to edit a referenced component, not to run it.

**Standalone.** Mirrors the workflow runner: web route `quickrun-function/:group/:name` + page, `FunctionQuickRunPanel`, `vnextForge.openFunctionQuickRun` (QuickPick over `**/Functions/**/*.json`) and `openFunctionQuickRunFromFile`, plus a Forge Tools tree entry.

---

## 7. Error handling

| Case | Surface |
|---|---|
| Non-2xx invoke | Normal response render with the status badge; body and headers shown as received |
| 401 / 403 | `FunctionRunAuthzBanner` above the response |
| 403 on `/info` | Same banner, stated as "cannot inspect or run" (shared access policy) |
| 404 on `/info` | "No `sys-functions` component for this key" — built-in system functions (`state`, `view`, `data`, …) legitimately 404 |
| Contract fetch 404 | Treated as "no contract right now", not an error — matches the `has*` semantics |
| Transport failure | `RUNTIME_CONNECTION_FAILED` banner with the runtime URL |
| Invalid href | `API_FORBIDDEN`, path shown |
| `F`/`I` without instance | Invoke disabled, inline reason next to the fields |

---

## 8. Testing

Vitest, `*.vitest.test.ts(x)` colocated, no jsdom — pure-function tests plus `renderToStaticMarkup` string assertions, as elsewhere in `designer-ui`.

- `functionRunPaths` — scope→path for all three scopes, missing workflow/instance, href validation accept/reject table (scheme, `//host`, `..`, missing `/functions/`, query strings)
- `functionRunVerbs` — declared verbs, absent, empty array, unknown verb filtered, default selection
- `functionRunPayload` — `buildInvokeRequest` across the verb × mode × content-type matrix: JSON vs form-urlencoded encoding, GET/DELETE → `query` with no body, view mode vs payload mode selection
- `functionRunStatus` — class boundaries (199/200/299/300/400/403/500), authorization detection
- `mergeQuickRunHeaders` — extended for the new tool-wide layer, including priority against the existing three
- Service tests with fixtures: 200, 403, 500, and a non-JSON body — each asserting the exchange is **returned, never thrown**, with `status` and `responseHeaders` intact. (No 304 case: the six discovery routes ship without ETag support.)
- `FunctionRunShell` render test: verb list from info, F/I disabled state, response pane with an error status

---

## Out of scope (Faz 3)

- Instance picker for `F`/`I` (workflow select → `quickrun/listInstances` → instance select)
- Payload presets (generalizing `quickrun-presets/*` beyond `workflowKey`)
- Reflecting `cacheable` / `rawResponse` in invoke behaviour — displayed from `/info`, not acted on
- Run history / replay
