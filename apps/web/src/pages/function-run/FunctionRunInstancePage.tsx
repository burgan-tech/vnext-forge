import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import {
  FunctionRunShell,
  functionRunInstanceTabId,
  useEditorStore,
  useRuntimeStore,
  useToolHeadersStore,
  type FunctionMetadataFormValues,
} from '@vnext-forge-studio/designer-ui';

type FunctionScope = FunctionMetadataFormValues['scope'];

const SCOPES: readonly FunctionScope[] = ['D', 'F', 'I'];

function readScope(raw: string | null): FunctionScope {
  // Instance-scoped by construction — this page is only reachable from a
  // running instance — so an unrecognised value falls back to `'I'` rather
  // than to the domain route, which would 403 for an instance function.
  return SCOPES.find((s) => s === raw) ?? 'I';
}

/**
 * Function Quick Runner opened from a live workflow instance.
 *
 * Sibling to `FunctionRunPage`, which resolves its identity by reading the
 * function's component file off a `:group/:name` path. Here the identity
 * comes from Quick Run's function catalog instead, so there is no file to
 * read — and none is needed: the runner is hypermedia-driven off `/info`,
 * which is what lets a function with no workspace component (a system
 * function, or one that came from a dependency) still open and run.
 *
 * `projectId` is still forwarded, because the runner uses it to resolve
 * *view* components referenced by whatever the function renders.
 */
export function FunctionRunInstancePage() {
  const { id, domain, functionKey } = useParams<{
    id: string;
    domain: string;
    functionKey: string;
  }>();
  const [searchParams] = useSearchParams();
  const openTab = useEditorStore((s) => s.openTab);
  const runtimeUrl = useRuntimeStore((s) => s.runtimeUrl);
  const toolWideHeaders = useToolHeadersStore((s) => s.headers);

  const scope = readScope(searchParams.get('scope'));
  const workflowKey = searchParams.get('workflowKey') ?? undefined;
  const instanceId = searchParams.get('instanceId') ?? undefined;
  const search = searchParams.toString();

  useEffect(() => {
    if (!id || !domain || !functionKey) return;
    openTab({
      id: functionRunInstanceTabId(id, domain, functionKey),
      kind: 'functionrun-instance',
      title: `Run: ${functionKey}`,
      group: domain,
      name: functionKey,
      // The binding lives outside the path, so it has to ride on the tab or
      // a restore-by-tab navigation would reopen the runner unbound.
      search,
    });
  }, [id, domain, functionKey, search, openTab]);

  if (!id || !domain || !functionKey) {
    return null;
  }

  return (
    <FunctionRunShell
      domain={domain}
      functionKey={functionKey}
      scope={scope}
      workflowKey={workflowKey}
      instanceId={instanceId}
      runtimeUrl={runtimeUrl}
      projectId={id}
      toolWideHeaders={toolWideHeaders}
      surface="standalone"
    />
  );
}
