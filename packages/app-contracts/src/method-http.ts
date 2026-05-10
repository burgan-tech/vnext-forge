export type MethodHttpVerb = 'GET' | 'POST' | 'PUT' | 'DELETE'
export type MethodHttpParamSource = 'query' | 'json'

export interface MethodHttpSpec {
  verb: MethodHttpVerb
  paramSource: MethodHttpParamSource
  successStatus?: 200 | 201
}

export type MethodId =
  | 'cli/check'
  | 'cli/checkUpdate'
  | 'cli/execute'
  | 'cli/updateGlobal'
  | 'files/read'
  | 'files/write'
  | 'files/delete'
  | 'files/mkdir'
  | 'files/rename'
  | 'files/browse'
  | 'files/search'
  | 'files/search/stream'
  | 'projects/list'
  | 'projects/getById'
  | 'projects/create'
  | 'projects/import'
  | 'projects/remove'
  | 'projects/export'
  | 'projects/getTree'
  | 'projects/getConfig'
  | 'projects/getConfigStatus'
  | 'projects/writeConfig'
  | 'projects/getVnextComponentLayoutStatus'
  | 'projects/seedVnextComponentLayout'
  | 'projects/getValidateScriptStatus'
  | 'projects/getComponentFileTypes'
  | 'projects/getWorkspaceBootstrap'
  | 'vnext/components/list'
  | 'vnext/tasks/list'
  | 'vnext/workflows/list'
  | 'vnext/schemas/list'
  | 'vnext/views/list'
  | 'vnext/functions/list'
  | 'vnext/extensions/list'
  | 'templates/validateScriptStatus'
  | 'validate/workflow'
  | 'validate/component'
  | 'validate/getAvailableTypes'
  | 'validate/getAllSchemas'
  | 'validate/getSchema'
  | 'quickrun/startInstance'
  | 'quickrun/fireTransition'
  | 'quickrun/getState'
  | 'quickrun/getView'
  | 'quickrun/getData'
  | 'quickrun/getSchema'
  | 'quickrun/getHistory'
  | 'quickrun/listInstances'
  | 'quickrun/getInstance'
  | 'quickrun/retryInstance'
  | 'quickswitcher/buildIndex'
  | 'snippets/listAll'
  | 'snippets/getOne'
  | 'snippets/save'
  | 'snippets/delete'
  | 'snippets/openLocation'
  | 'sessions/get'
  | 'sessions/save'
  | 'sessions/clear'
  | 'test-data/generate'
  | 'test-data/generateForSchemaComponent'
  | 'test-data/generateForSchemaReference'
  | 'quickrun-presets/list'
  | 'quickrun-presets/get'
  | 'quickrun-presets/save'
  | 'quickrun-presets/delete'
  | 'runtime/proxy'
  | 'health/check'

export const METHOD_HTTP_METADATA: Readonly<Record<MethodId, MethodHttpSpec>> = Object.freeze({
  'cli/check': { verb: 'POST', paramSource: 'json' },
  'cli/checkUpdate': { verb: 'POST', paramSource: 'json' },
  'cli/execute': { verb: 'POST', paramSource: 'json' },
  'cli/updateGlobal': { verb: 'POST', paramSource: 'json' },
  'files/read': { verb: 'GET', paramSource: 'query' },
  'files/write': { verb: 'PUT', paramSource: 'json' },
  'files/delete': { verb: 'DELETE', paramSource: 'query' },
  'files/mkdir': { verb: 'POST', paramSource: 'json' },
  'files/rename': { verb: 'POST', paramSource: 'json' },
  'files/browse': { verb: 'GET', paramSource: 'query' },
  'files/search': { verb: 'POST', paramSource: 'json' },
  'files/search/stream': { verb: 'POST', paramSource: 'json' },
  'projects/list': { verb: 'GET', paramSource: 'query' },
  'projects/getById': { verb: 'GET', paramSource: 'query' },
  'projects/create': { verb: 'POST', paramSource: 'json', successStatus: 201 },
  'projects/import': { verb: 'POST', paramSource: 'json', successStatus: 201 },
  'projects/remove': { verb: 'DELETE', paramSource: 'query' },
  'projects/export': { verb: 'POST', paramSource: 'json' },
  'projects/getTree': { verb: 'GET', paramSource: 'query' },
  'projects/getConfig': { verb: 'GET', paramSource: 'query' },
  'projects/getConfigStatus': { verb: 'GET', paramSource: 'query' },
  'projects/writeConfig': { verb: 'PUT', paramSource: 'json' },
  'projects/getVnextComponentLayoutStatus': { verb: 'GET', paramSource: 'query' },
  'projects/seedVnextComponentLayout': { verb: 'PUT', paramSource: 'json' },
  'projects/getValidateScriptStatus': { verb: 'GET', paramSource: 'query' },
  'projects/getComponentFileTypes': { verb: 'GET', paramSource: 'query' },
  'projects/getWorkspaceBootstrap': { verb: 'GET', paramSource: 'query' },
  'vnext/components/list': { verb: 'GET', paramSource: 'query' },
  'vnext/tasks/list': { verb: 'GET', paramSource: 'query' },
  'vnext/workflows/list': { verb: 'GET', paramSource: 'query' },
  'vnext/schemas/list': { verb: 'GET', paramSource: 'query' },
  'vnext/views/list': { verb: 'GET', paramSource: 'query' },
  'vnext/functions/list': { verb: 'GET', paramSource: 'query' },
  'vnext/extensions/list': { verb: 'GET', paramSource: 'query' },
  'templates/validateScriptStatus': { verb: 'POST', paramSource: 'json' },
  'validate/workflow': { verb: 'POST', paramSource: 'json' },
  'validate/component': { verb: 'POST', paramSource: 'json' },
  'validate/getAvailableTypes': { verb: 'GET', paramSource: 'query' },
  'validate/getAllSchemas': { verb: 'GET', paramSource: 'query' },
  'validate/getSchema': { verb: 'GET', paramSource: 'query' },
  'quickrun/startInstance': { verb: 'POST', paramSource: 'json' },
  'quickrun/fireTransition': { verb: 'POST', paramSource: 'json' },
  'quickrun/getState': { verb: 'POST', paramSource: 'json' },
  'quickrun/getView': { verb: 'POST', paramSource: 'json' },
  'quickrun/getData': { verb: 'POST', paramSource: 'json' },
  'quickrun/getSchema': { verb: 'POST', paramSource: 'json' },
  'quickrun/getHistory': { verb: 'POST', paramSource: 'json' },
  'quickrun/listInstances': { verb: 'POST', paramSource: 'json' },
  'quickrun/getInstance': { verb: 'POST', paramSource: 'json' },
  'quickrun/retryInstance': { verb: 'POST', paramSource: 'json' },
  'quickswitcher/buildIndex': { verb: 'POST', paramSource: 'json' },
  'snippets/listAll': { verb: 'POST', paramSource: 'json' },
  'snippets/getOne': { verb: 'POST', paramSource: 'json' },
  'snippets/save': { verb: 'POST', paramSource: 'json', successStatus: 201 },
  'snippets/delete': { verb: 'POST', paramSource: 'json' },
  'snippets/openLocation': { verb: 'POST', paramSource: 'json' },
  'sessions/get': { verb: 'POST', paramSource: 'json' },
  'sessions/save': { verb: 'POST', paramSource: 'json' },
  'sessions/clear': { verb: 'POST', paramSource: 'json' },
  'test-data/generate': { verb: 'POST', paramSource: 'json' },
  'test-data/generateForSchemaComponent': { verb: 'POST', paramSource: 'json' },
  'test-data/generateForSchemaReference': { verb: 'POST', paramSource: 'json' },
  'quickrun-presets/list': { verb: 'POST', paramSource: 'json' },
  'quickrun-presets/get': { verb: 'POST', paramSource: 'json' },
  'quickrun-presets/save': { verb: 'POST', paramSource: 'json', successStatus: 201 },
  'quickrun-presets/delete': { verb: 'POST', paramSource: 'json' },
  'runtime/proxy': { verb: 'POST', paramSource: 'json' },
  'health/check': { verb: 'GET', paramSource: 'query' },
})

export function getMethodHttpSpec(method: string): MethodHttpSpec | undefined {
  if (Object.prototype.hasOwnProperty.call(METHOD_HTTP_METADATA, method)) {
    return METHOD_HTTP_METADATA[method as MethodId]
  }
  return undefined
}

export function listMethodHttpSpecs(): readonly { method: MethodId; spec: MethodHttpSpec }[] {
  return (Object.keys(METHOD_HTTP_METADATA) as MethodId[]).map((method) => ({
    method,
    spec: METHOD_HTTP_METADATA[method],
  }))
}
