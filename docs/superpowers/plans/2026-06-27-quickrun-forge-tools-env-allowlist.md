# QuickRun Forge Tools Environment Allowlist Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user adds an environment URL in Forge Tools, QuickRun should be able to proxy to that URL without getting "You do not have permission to perform this action."

**Architecture:** `RuntimeProxyService` is constructed once at extension activation with a static allowlist from `extensionConfig`. Forge Tools environments are stored separately in `ForgeToolsSettingsService` and are never wired into the proxy. The fix adds a callback overload for `allowedBaseUrls` so the proxy resolves the current Forge Tools environment list at request time, and always enables `allowRuntimeUrlOverride` in the extension host (a trusted local tool, not a web server).

**Tech Stack:** TypeScript, `packages/services-core`, `apps/extension`

---

## Root cause

`createRuntimeProxyService` is built in `composeExtensionServices()` with `allowRuntimeUrlOverride: extensionConfig.allowRuntimeUrlOverride` (defaults to `false`). Any `runtimeUrl` that differs from `defaultRuntimeUrl` is immediately rejected with `ERROR_CODES.API_FORBIDDEN` — regardless of what the user added in Forge Tools. The Forge Tools `EnvironmentsConfig` is never consulted by the proxy.

---

## File map

| File | Change |
|------|--------|
| `packages/services-core/src/services/runtime-proxy/runtime-proxy.service.ts` | Accept `allowedBaseUrls` as `readonly string[] \| (() => readonly string[])` |
| `apps/extension/src/tools/forge-tools-settings.ts` | Add `getCachedEnvironmentUrls(): string[]` |
| `apps/extension/src/composition/services.ts` | Accept `ForgeToolsSettingsService`, enable override, pass callback |
| `apps/extension/src/extension.ts` | Create `forgeToolsSettings` before `composeExtensionServices`, pass it in |
| `apps/server/src/__tests__/runtime-proxy-allowlist.test.ts` | Add callback-based allowlist test cases |

---

## Task 1: Support `allowedBaseUrls` callback in `RuntimeProxyService`

**Files:**
- Modify: `packages/services-core/src/services/runtime-proxy/runtime-proxy.service.ts`

- [ ] **Step 1: Write the failing test for callback allowedBaseUrls**

Add to `apps/server/src/__tests__/runtime-proxy-allowlist.test.ts`:

```typescript
it('accepts runtimeUrl returned by an allowedBaseUrls callback', async () => {
  const network = createNetworkStub()
  let dynamicUrls: string[] = []
  const proxy = createRuntimeProxyService({
    network,
    logger: noopLogger,
    defaultRuntimeUrl: 'http://localhost:4201',
    allowRuntimeUrlOverride: true,
    allowedBaseUrls: () => dynamicUrls,
  })

  // Before the URL is in the list → rejected
  await expect(
    proxy.proxy({ method: 'GET', runtimePath: '/health', runtimeUrl: 'http://runtime.example.com' }),
  ).rejects.toMatchObject({ code: ERROR_CODES.API_FORBIDDEN })

  // Add to dynamic list → now accepted
  dynamicUrls = ['http://runtime.example.com']
  await proxy.proxy({ method: 'GET', runtimePath: '/health', runtimeUrl: 'http://runtime.example.com' })
  expect(network.calls).toEqual(['http://runtime.example.com/health'])
})

it('rejects runtimeUrl not returned by the allowedBaseUrls callback', async () => {
  const network = createNetworkStub()
  const proxy = createRuntimeProxyService({
    network,
    logger: noopLogger,
    defaultRuntimeUrl: 'http://localhost:4201',
    allowRuntimeUrlOverride: true,
    allowedBaseUrls: () => ['http://localhost:4202'],
  })

  await expect(
    proxy.proxy({ method: 'GET', runtimePath: '/health', runtimeUrl: 'http://169.254.169.254' }),
  ).rejects.toMatchObject({ code: ERROR_CODES.API_FORBIDDEN })
  expect(network.calls).toEqual([])
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/U0B006/Documents/repos/burgan-tech/vnext-forge
pnpm --filter @vnext-forge-studio/server test --reporter=verbose 2>&1 | grep -A5 "allowedBaseUrls callback\|allowedBaseUrls callback\|FAIL\|PASS"
```

Expected: Tests fail with a TypeScript type error or runtime error because callback overload is not yet supported.

- [ ] **Step 3: Update `RuntimeProxyServiceDeps` and `proxy()` function**

In `packages/services-core/src/services/runtime-proxy/runtime-proxy.service.ts`, change:

```typescript
// BEFORE
export interface RuntimeProxyServiceDeps {
  network: NetworkAdapter
  logger: LoggerAdapter
  defaultRuntimeUrl?: string
  allowedBaseUrls?: readonly string[]
  allowRuntimeUrlOverride?: boolean
}
```

```typescript
// AFTER
export interface RuntimeProxyServiceDeps {
  network: NetworkAdapter
  logger: LoggerAdapter
  defaultRuntimeUrl?: string
  /**
   * Extra runtime base URLs that may be targeted via `req.runtimeUrl`. The
   * `defaultRuntimeUrl` is implicitly always allowed; this list extends it.
   * If `allowRuntimeUrlOverride` is `false`, this list is ignored — only
   * the default is reachable.
   *
   * May be a callback so callers can provide a live-updating list
   * (e.g. Forge Tools environments) without recreating the service.
   */
  allowedBaseUrls?: readonly string[] | (() => readonly string[])
  allowRuntimeUrlOverride?: boolean
}
```

Then change `createRuntimeProxyService` to resolve the allowlist per-request instead of at construction time:

```typescript
export function createRuntimeProxyService(deps: RuntimeProxyServiceDeps) {
  const {
    network,
    defaultRuntimeUrl = 'http://localhost:4201',
    allowedBaseUrls: allowedBaseUrlsSource = [],
    allowRuntimeUrlOverride = false,
  } = deps

  const normalize = (u: string) => u.trim().replace(/\/+$/, '')
  const normalizedDefault = normalize(defaultRuntimeUrl)

  async function proxy(
    req: z.infer<typeof runtimeProxyParams>,
    traceId?: string,
  ): Promise<z.infer<typeof runtimeProxyResult>> {
    // Resolve the allowlist fresh on each call so callback-based lists
    // (e.g. live Forge Tools environments) stay current.
    const rawAllowedUrls =
      typeof allowedBaseUrlsSource === 'function'
        ? allowedBaseUrlsSource()
        : allowedBaseUrlsSource
    const allowed = new Set<string>([
      normalizedDefault,
      ...rawAllowedUrls.map(normalize),
    ])

    let runtimeUrl: string
    if (req.runtimeUrl) {
      const candidate = normalize(req.runtimeUrl)

      if (candidate !== normalizedDefault && !allowRuntimeUrlOverride) {
        throw new VnextForgeError(
          ERROR_CODES.API_FORBIDDEN,
          'runtimeUrl override is disabled on this server. ' +
            'Set ALLOW_RUNTIME_URL_OVERRIDE=true and add the URL to ' +
            'RUNTIME_ALLOWED_BASE_URLS to enable it.',
          {
            source: 'RuntimeProxyService.proxy',
            layer: 'transport',
            details: { attemptedRuntimeUrl: req.runtimeUrl },
          },
          traceId,
        )
      }
      const hasExplicitAllowlist = rawAllowedUrls.length > 0
      if (hasExplicitAllowlist && !allowed.has(candidate)) {
        throw new VnextForgeError(
          ERROR_CODES.API_FORBIDDEN,
          `runtimeUrl ${req.runtimeUrl} is not in the allow-list.`,
          {
            source: 'RuntimeProxyService.proxy',
            layer: 'transport',
            details: {
              attemptedRuntimeUrl: req.runtimeUrl,
              allowedBaseUrls: [...allowed],
            },
          },
          traceId,
        )
      }
      runtimeUrl = candidate
    } else {
      runtimeUrl = normalizedDefault
    }
    // ... rest of proxy() unchanged from line 169 onward
```

Note: delete the old `normalize` + `allowed` Set construction block that previously appeared at lines 119–123 of the original file (the constructor-time pre-computation). Keep everything from `const url = \`${runtimeUrl}${req.runtimePath}\`` onward unchanged.

- [ ] **Step 4: Run the new tests — they should pass**

```bash
pnpm --filter @vnext-forge-studio/server test --reporter=verbose 2>&1 | grep -E "allowedBaseUrls callback|✓|✗|FAIL|PASS"
```

Expected: both new tests pass; all existing tests in the file still pass.

- [ ] **Step 5: Commit**

```bash
git add packages/services-core/src/services/runtime-proxy/runtime-proxy.service.ts \
        apps/server/src/__tests__/runtime-proxy-allowlist.test.ts
git commit -m "feat(services-core): support callback allowedBaseUrls in RuntimeProxyService"
```

---

## Task 2: Expose cached environment URLs from `ForgeToolsSettingsService`

**Files:**
- Modify: `apps/extension/src/tools/forge-tools-settings.ts`

- [ ] **Step 1: Add `getCachedEnvironmentUrls()` method**

In `ForgeToolsSettingsService`, after the `getActiveEnvironment` method (line ~312), add:

```typescript
/**
 * Returns the base URLs of all currently cached environments.
 * Returns an empty array if `loadEnvironments()` has not been called yet
 * or if no environments are configured.
 *
 * Intended for use as a live callback in `RuntimeProxyService` so the
 * proxy's allowlist automatically reflects Forge Tools environments without
 * requiring a service restart.
 */
getCachedEnvironmentUrls(): string[] {
  return this.environmentsCache?.environments.map((e) => e.baseUrl) ?? [];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm --filter vnext-forge-studio build 2>&1 | tail -20
```

Expected: no new TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/extension/src/tools/forge-tools-settings.ts
git commit -m "feat(extension): expose getCachedEnvironmentUrls on ForgeToolsSettingsService"
```

---

## Task 3: Wire Forge Tools environments into the extension's `RuntimeProxyService`

**Files:**
- Modify: `apps/extension/src/composition/services.ts`

- [ ] **Step 1: Update `composeExtensionServices` signature to accept `ForgeToolsSettingsService`**

At the top of `apps/extension/src/composition/services.ts`, add the import:

```typescript
import type { ForgeToolsSettingsService } from '../tools/forge-tools-settings.js';
```

Change the function signature from:

```typescript
export function composeExtensionServices(logger: LoggerAdapter): ComposedServices {
```

to:

```typescript
export function composeExtensionServices(
  logger: LoggerAdapter,
  forgeToolsSettings?: ForgeToolsSettingsService,
): ComposedServices {
```

- [ ] **Step 2: Replace the static `RuntimeProxyService` construction with a dynamic one**

Change lines 145–151 from:

```typescript
const runtimeProxyService = createRuntimeProxyService({
  network,
  logger,
  defaultRuntimeUrl: extensionConfig.vnextRuntimeUrl,
  allowedBaseUrls: extensionConfig.runtimeAllowedBaseUrls,
  allowRuntimeUrlOverride: extensionConfig.allowRuntimeUrlOverride,
})
```

to:

```typescript
const runtimeProxyService = createRuntimeProxyService({
  network,
  logger,
  defaultRuntimeUrl: extensionConfig.vnextRuntimeUrl,
  // The extension host is a trusted local process (not a web server), so URL
  // overrides are always allowed. The per-request allowlist provides the
  // actual scope: VS Code settings URLs + Forge Tools environments.
  allowRuntimeUrlOverride: true,
  allowedBaseUrls: forgeToolsSettings
    ? () => [
        ...extensionConfig.runtimeAllowedBaseUrls,
        ...forgeToolsSettings.getCachedEnvironmentUrls(),
      ]
    : extensionConfig.runtimeAllowedBaseUrls,
})
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm --filter vnext-forge-studio build 2>&1 | tail -20
```

Expected: no new TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add apps/extension/src/composition/services.ts
git commit -m "feat(extension): wire Forge Tools environments into RuntimeProxyService allowlist"
```

---

## Task 4: Pass `ForgeToolsSettingsService` to `composeExtensionServices` in `extension.ts`

**Files:**
- Modify: `apps/extension/src/extension.ts`

- [ ] **Step 1: Move `forgeToolsSettings` creation before `composeExtensionServices`**

Currently in `extension.ts`, `composeExtensionServices` is called at around line 128, and `ForgeToolsSettingsService` is instantiated at around line 195. We need to reverse that order.

Find the block that creates `forgeToolsSettings` (around line 195):

```typescript
const forgeToolsSettings = new ForgeToolsSettingsService(context.globalStorageUri);
context.subscriptions.push(forgeToolsSettings);
// ...
await forgeToolsSettings.loadSettings();
await forgeToolsSettings.loadEnvironments();
```

Move the instantiation and `context.subscriptions.push` to **before** the `composeExtensionServices` call (i.e., before line 128). Leave the `loadSettings()` / `loadEnvironments()` `await` calls in their current position (they'll still run at the right time — loading is separate from construction).

After the move, `extension.ts` should look like:

```typescript
// ... (existing setup above line 128)

const forgeToolsSettings = new ForgeToolsSettingsService(context.globalStorageUri);
context.subscriptions.push(forgeToolsSettings);

const { services, registry } = composeExtensionServices(loggerAdapter, forgeToolsSettings);
const { bridge: lspBridge, installer: lspInstaller } = createExtensionHostLspStack(loggerAdapter);

// ... (rest of activation — designerPanel, detector, etc.)

await forgeToolsSettings.loadSettings();
await forgeToolsSettings.loadEnvironments();
// ...
```

(The `await` calls stay where they are — after async bootstrap steps that previously preceded them. Only the `new ForgeToolsSettingsService(...)` + `context.subscriptions.push` lines are moved up.)

- [ ] **Step 2: Verify TypeScript compiles and extension builds**

```bash
pnpm --filter vnext-forge-studio build 2>&1 | tail -30
```

Expected: no errors, `dist/extension.js` regenerated.

- [ ] **Step 3: Commit**

```bash
git add apps/extension/src/extension.ts
git commit -m "fix(extension): pass ForgeToolsSettingsService to composeExtensionServices so Forge Tools env URLs are proxied"
```

---

## Task 5: Smoke-test in the extension

- [ ] **Step 1: Open the extension in VS Code (Extension Development Host)**

Press **F5** in the repo root VS Code window (or run `pnpm --filter vnext-forge-studio build` then launch via the `.vscode/launch.json` config).

- [ ] **Step 2: Add a test environment in Forge Tools**

In the Extension Development Host:
1. Open the Forge Tools sidebar (activity bar).
2. In the **Environments** section, click **Add Environment**.
3. Enter a name (e.g. `Local Dev`) and URL (e.g. `http://localhost:4201`).
4. Set it as the active environment.

- [ ] **Step 3: Open a workflow in the designer and trigger QuickRun**

Navigate to a workflow file, open Quick Run, and attempt to start an instance or list instances. Confirm no "You do not have permission to perform this action." error appears.

- [ ] **Step 4: Add a second environment with a different port and verify it also works**

Add `http://localhost:9000` (or any URL your runtime is actually listening on), switch to it, run again. Confirm it proxies to the correct URL.

---

## Self-review

**Spec coverage:**
- ✅ Forge Tools environment URL is proxied — Tasks 1–4.
- ✅ Existing `runtimeAllowedBaseUrls` VS Code setting still respected — Task 3 step 2 merges them.
- ✅ Static array `allowedBaseUrls` (server usage) is unchanged — Task 1 uses `typeof === 'function'` check.
- ✅ SSRF defense preserved on web server (`apps/server`) — `allowRuntimeUrlOverride` still defaults to `false` there; only the extension changes to `true`.

**No placeholders — all code shown inline.**

**Type consistency:** `getCachedEnvironmentUrls(): string[]` returns `string[]`, same type as `extensionConfig.runtimeAllowedBaseUrls: string[]`, so spread in Task 3 is type-safe.
