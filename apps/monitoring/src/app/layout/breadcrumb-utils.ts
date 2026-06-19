export interface Crumb {
  label: string;
  path?: string;
}

export function buildBreadcrumbs(
  pathname: string,
  params: Record<string, string | undefined>,
  domainDisplayName: string,
): Crumb[] {
  const domain: Crumb = { label: domainDisplayName };

  if (pathname === '/') {
    return [domain, { label: 'Dashboard' }];
  }

  if (pathname === '/faults') {
    return [domain, { label: 'Faults' }];
  }

  if (pathname === '/jobs') {
    return [domain, { label: 'Jobs' }];
  }

  if (pathname === '/config') {
    return [domain, { label: 'Config' }];
  }

  if (pathname.match(/^\/definitions\/[^/]+$/) && params.type) {
    const label = DEFINITION_TYPE_LABELS[params.type] ?? params.type;
    return [
      domain,
      { label: 'Definitions', path: '/definitions/workflow' },
      { label },
    ];
  }

  if (pathname.match(/^\/definitions\/[^/]+\/[^/]+$/) && params.type && params.id) {
    const typeLabel = DEFINITION_TYPE_LABELS[params.type] ?? params.type;
    return [
      domain,
      { label: 'Definitions', path: '/definitions/workflow' },
      { label: typeLabel, path: `/definitions/${params.type}` },
      { label: params.id },
    ];
  }

  if (pathname.includes('/instances') && params.wfId) {
    return [
      domain,
      { label: 'Definitions', path: '/definitions/workflow' },
      { label: 'Workflows', path: '/definitions/workflow' },
      { label: params.wfId, path: `/definitions/workflow/${params.wfId}` },
      { label: 'Instances' },
    ];
  }

  if (pathname.startsWith('/instances/') && params.instanceId) {
    return [domain, { label: 'Instances', path: undefined }, { label: params.instanceId }];
  }

  return [domain, { label: pathname }];
}

export const DEFINITION_TYPE_LABELS: Record<string, string> = {
  workflow: 'Workflows',
  task: 'Tasks',
  function: 'Functions',
  view: 'Views',
  extension: 'Extensions',
  schema: 'Schemas',
  mapping: 'Mappings',
};
