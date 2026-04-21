import type { ApiClient } from './client';

interface QueryArg {
  query?: Record<string, string | undefined>;
}
interface JsonArg {
  json: unknown;
}

/**
 * Typed `/api/v1/*` subtree. `hc<AppType>` types some top-level routes on
 * `client.api` (e.g. `/api/health`) but does not currently expose the
 * `/api/v1` mount as `client.api.v1`, so this interface is the compile-time contract.
 */
export interface ApiV1Client {
  files: {
    read: { $get: (args?: QueryArg) => Promise<Response> };
    write: { $put: (args: JsonArg) => Promise<Response> };
    delete: { $delete: (args?: QueryArg) => Promise<Response> };
    mkdir: { $post: (args: JsonArg) => Promise<Response> };
    rename: { $post: (args: JsonArg) => Promise<Response> };
    browse: { $get: (args?: QueryArg) => Promise<Response> };
    search: { $get: (args?: QueryArg) => Promise<Response> };
  };
  projects: {
    list: { $get: (args?: QueryArg) => Promise<Response> };
    getById: { $get: (args?: QueryArg) => Promise<Response> };
    create: { $post: (args: JsonArg) => Promise<Response> };
    import: { $post: (args: JsonArg) => Promise<Response> };
    remove: { $delete: (args?: QueryArg) => Promise<Response> };
    export: { $post: (args: JsonArg) => Promise<Response> };
    getTree: { $get: (args?: QueryArg) => Promise<Response> };
    getConfig: { $get: (args?: QueryArg) => Promise<Response> };
    getConfigStatus: { $get: (args?: QueryArg) => Promise<Response> };
    writeConfig: { $put: (args: JsonArg) => Promise<Response> };
    getVnextComponentLayoutStatus: { $get: (args?: QueryArg) => Promise<Response> };
    seedVnextComponentLayout: { $put: (args: JsonArg) => Promise<Response> };
    getValidateScriptStatus: { $get: (args?: QueryArg) => Promise<Response> };
    getComponentFileTypes: { $get: (args?: QueryArg) => Promise<Response> };
    getWorkspaceBootstrap: { $get: (args?: QueryArg) => Promise<Response> };
  };
  templates: {
    validateScriptStatus: { $post: (args: JsonArg) => Promise<Response> };
  };
  validate: {
    workflow: { $post: (args: JsonArg) => Promise<Response> };
    component: { $post: (args: JsonArg) => Promise<Response> };
    getAvailableTypes: { $get: (args?: QueryArg) => Promise<Response> };
    getAllSchemas: { $get: (args?: QueryArg) => Promise<Response> };
    getSchema: { $get: (args?: QueryArg) => Promise<Response> };
  };
  runtime: {
    proxy: { $post: (args: JsonArg) => Promise<Response> };
  };
  health: {
    check: { $get: (args?: QueryArg) => Promise<Response> };
  };
}

export function asApiV1Client(client: ApiClient): ApiV1Client {
  // `hc<AppType>` currently types `client.api` from top-level routes only (e.g.
  // `/api/health` → `.api.health`); the `/api/v1/*` mount is not surfaced as
  // `.api.v1`, so we assert the v1 subtree shape we know matches `ApiV1Client`.
  return (client as unknown as { api: { v1: ApiV1Client } }).api.v1;
}
