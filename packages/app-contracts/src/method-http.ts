export type MethodHttpVerb = 'GET' | 'POST' | 'PUT' | 'DELETE'
export type MethodHttpParamSource = 'query' | 'json'

export interface MethodHttpSpec {
  verb: MethodHttpVerb
  paramSource: MethodHttpParamSource
  successStatus?: 200 | 201
}

export type MethodId =
  | 'files/read'
  | 'files/write'
  | 'files/delete'
  | 'files/mkdir'
  | 'files/rename'
  | 'files/browse'
  | 'files/search'
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
  | 'templates/validateScriptStatus'
  | 'validate/workflow'
  | 'validate/component'
  | 'validate/getAvailableTypes'
  | 'validate/getAllSchemas'
  | 'validate/getSchema'
  | 'runtime/proxy'
  | 'health/check'

export const METHOD_HTTP_METADATA: Readonly<Record<MethodId, MethodHttpSpec>> = Object.freeze({
  'files/read': { verb: 'GET', paramSource: 'query' },
  'files/write': { verb: 'PUT', paramSource: 'json' },
  'files/delete': { verb: 'DELETE', paramSource: 'query' },
  'files/mkdir': { verb: 'POST', paramSource: 'json' },
  'files/rename': { verb: 'POST', paramSource: 'json' },
  'files/browse': { verb: 'GET', paramSource: 'query' },
  'files/search': { verb: 'GET', paramSource: 'query' },
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
  'templates/validateScriptStatus': { verb: 'POST', paramSource: 'json' },
  'validate/workflow': { verb: 'POST', paramSource: 'json' },
  'validate/component': { verb: 'POST', paramSource: 'json' },
  'validate/getAvailableTypes': { verb: 'GET', paramSource: 'query' },
  'validate/getAllSchemas': { verb: 'GET', paramSource: 'query' },
  'validate/getSchema': { verb: 'GET', paramSource: 'query' },
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
