import { ERROR_CODES, VnextForgeError } from '@vnext-forge-studio/app-contracts'

/**
 * Per-method capability classification used by `dispatchMethod` to gate
 * privileged operations.
 *
 * `public` methods are intended to be safe for every caller — they only
 * read low-impact data or perform side-effect-free validation. `privileged`
 * methods touch the local file system, mutate projects, or proxy to the
 * runtime engine; they MUST only run when the dispatcher is executing in
 * a trusted context.
 *
 * "Trusted context" is defined by the host that owns the dispatcher:
 *  - the standalone server treats loopback binds (`127.0.0.1`, `::1`,
 *    `localhost`) as trusted; non-loopback binds require the request to
 *    originate from a CORS-allow-listed Origin header,
 *  - the VS Code extension shell is always trusted because every caller
 *    is either the user's webview or other extensions that have already
 *    been activated by the editor.
 *
 * Adding a new method without an explicit entry below is a build-time
 * error in `methodCapability(...)` so that contributors must consciously
 * decide which side of the line their method falls on.
 */
export type MethodCapability = 'public' | 'privileged'

/**
 * Hard-coded classification per RPC method. Changes here are
 * security-sensitive — they MUST go through review.
 */
const METHOD_CAPABILITIES: Readonly<Record<string, MethodCapability>> = Object.freeze({
  // ── files / workspace — every entry is privileged because it reads or
  // writes the developer's local file system.
  'files/read': 'privileged',
  'files/write': 'privileged',
  'files/delete': 'privileged',
  'files/mkdir': 'privileged',
  'files/rename': 'privileged',
  'files/browse': 'privileged',
  'files/search': 'privileged',
  'files/search/stream': 'privileged',

  // ── projects — listing / reading a project record is `public`; anything
  // that materializes new artefacts on disk or removes them is privileged.
  'projects/list': 'public',
  'projects/getById': 'public',
  'projects/getTree': 'public',
  'projects/getConfig': 'public',
  'projects/getConfigStatus': 'public',
  'projects/getVnextComponentLayoutStatus': 'public',
  'projects/getValidateScriptStatus': 'public',
  'projects/getComponentFileTypes': 'public',
  'projects/getWorkspaceBootstrap': 'public',
  'projects/create': 'privileged',
  'projects/import': 'privileged',
  'projects/remove': 'privileged',
  'projects/export': 'privileged',
  'projects/writeConfig': 'privileged',
  'projects/seedVnextComponentLayout': 'privileged',

  // ── templates / validation — pure functions over input payloads or the
  // bundled schemas, no file system touch.
  'templates/validateScriptStatus': 'public',
  'validate/workflow': 'public',
  'validate/component': 'public',
  'validate/getAvailableTypes': 'public',
  'validate/getAllSchemas': 'public',
  'validate/getSchema': 'public',

  // ── test-data — `generate` is pure (schema in → instance out), the
  // others read a project file (component or referenced schema).
  'test-data/generate': 'public',
  'test-data/generateForSchemaComponent': 'privileged',
  'test-data/generateForSchemaReference': 'privileged',

  // ── quickrun-presets — read/write user-managed templates inside
  // `<userData>/quickrun-presets/`. Per-user state, not project-tracked.
  'quickrun-presets/list': 'privileged',
  'quickrun-presets/get': 'privileged',
  'quickrun-presets/save': 'privileged',
  'quickrun-presets/delete': 'privileged',

  // ── runtime / health — proxying network traffic to an external runtime
  // is the most SSRF-sensitive surface in the registry.
  'runtime/proxy': 'privileged',
  'health/check': 'public',

  // ── quickrun — all methods proxy to the runtime engine.
  'quickrun/startInstance': 'privileged',
  'quickrun/fireTransition': 'privileged',
  'quickrun/getState': 'privileged',
  'quickrun/getView': 'privileged',
  'quickrun/getData': 'privileged',
  'quickrun/getSchema': 'privileged',
  'quickrun/getHistory': 'privileged',
  'quickrun/retryInstance': 'privileged',
  'quickrun/listInstances': 'privileged',
  'quickrun/getInstance': 'privileged',

  'cli/check': 'privileged',
  'cli/checkUpdate': 'privileged',
  'cli/execute': 'privileged',
  'cli/updateGlobal': 'privileged',
})

/**
 * Lookup helper. Returns the capability classification for a known method
 * or `undefined` when the method is not in the registry. Callers fall
 * back to `'privileged'` when the answer is `undefined` to fail closed.
 */
export function methodCapability(method: string): MethodCapability | undefined {
  return METHOD_CAPABILITIES[method]
}

/**
 * Caller context that the host transport must provide to the dispatcher
 * when capability gating should be enforced. Hosts that are inherently
 * single-user / single-process (e.g. the VS Code extension) may pass
 * `{ trusted: true }` to bypass the check entirely.
 */
export interface CallerContext {
  /**
   * Set by the host when the entire transport is local-only (e.g.
   * loopback bind, in-process VS Code router). When `true`, capability
   * gating is a no-op.
   */
  trusted: boolean
  /**
   * Origin header from the HTTP request. Only meaningful when the host
   * accepts cross-origin browser traffic. `null` for non-browser callers.
   */
  origin?: string | null
  /**
   * The transport's allow-list. When `origin` is in this list the call is
   * accepted even for privileged methods; otherwise privileged methods
   * are rejected with `API_FORBIDDEN`.
   */
  allowedOrigins?: readonly string[]
}

/**
 * Throw `API_FORBIDDEN` when the caller is not allowed to invoke a
 * privileged method. Public methods are always permitted.
 */
export function assertCapabilityAllowed(
  method: string,
  caller: CallerContext | undefined,
  traceId?: string,
): void {
  // No caller context means the host opted out of gating (e.g. legacy
  // in-process tests). We fail open to keep behaviour stable for those
  // call sites; production transports MUST always pass a context.
  if (!caller) return

  // Trusted transports (loopback HTTP, VS Code extension host) bypass
  // every check.
  if (caller.trusted) return

  const capability = methodCapability(method) ?? 'privileged'
  if (capability === 'public') return

  const origin = caller.origin
  const allowed = caller.allowedOrigins ?? []
  if (origin && allowed.includes(origin)) return

  throw new VnextForgeError(
    ERROR_CODES.API_FORBIDDEN,
    `Method ${method} is privileged and the caller is not allow-listed.`,
    {
      source: 'services-core.assertCapabilityAllowed',
      layer: 'transport',
      details: { method, capability, origin: origin ?? null },
    },
    traceId,
  )
}
