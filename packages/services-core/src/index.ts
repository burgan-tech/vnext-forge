// ─────────────────────────────────────────────────────────────────────────────
// `@vnext-forge/services-core` - runtime entrypoint.
//
// Intended for Node-side shells only (web-server, extension host). The web
// frontend bundle MUST import from `@vnext-forge/services-core/types` to avoid
// pulling Node-only dependencies (Ajv, child_process based template runner...)
// into the browser.
// ─────────────────────────────────────────────────────────────────────────────

export * from './adapters/index.js'

export * as paths from './internal/paths.js'
export { getErrnoCode, toFileVnextError } from './internal/errno.js'

export * from './services/workspace/index.js'
export * from './services/template/index.js'
export * from './services/validate/index.js'
export * from './services/runtime-proxy/index.js'
export * from './services/file-router/index.js'
export * from './services/project/index.js'

export * from './registry/index.js'
