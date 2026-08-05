import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import {
  FunctionRunShell,
  functionRunTabId,
  toFunctionMetadataFormValues,
  useEditorStore,
  useProjectStore,
  useRuntimeStore,
  useToolHeadersStore,
  type FunctionMetadataFormValues,
} from '@vnext-forge-studio/designer-ui';

import { filesService } from '../../services';

interface FunctionIdentity {
  domain: string;
  functionKey: string;
  scope: FunctionMetadataFormValues['scope'];
}

export function FunctionRunPage() {
  const { id, group, name } = useParams<{ id: string; group: string; name: string }>();
  const openTab = useEditorStore((s) => s.openTab);
  const projectPath = useProjectStore((s) => s.activeProject?.path);
  const vnextConfig = useProjectStore((s) => s.vnextConfig);
  const runtimeUrl = useRuntimeStore((s) => s.runtimeUrl);
  const toolWideHeaders = useToolHeadersStore((s) => s.headers);

  const functionFilePath = useMemo(() => {
    if (!projectPath || !vnextConfig?.paths || !group || !name) return null;
    const base = `${projectPath}/${vnextConfig.paths.componentsRoot}/${vnextConfig.paths.functions}`;
    const dir = group ? `${base}/${group}` : base;
    return `${dir}/${name}.json`.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  }, [projectPath, vnextConfig, group, name]);

  /**
   * The read result, tagged with the path it belongs to.
   *
   * Keyed rather than reset-on-change so the effect never calls `setState`
   * synchronously in its body (which cascades a render — `react-hooks/
   * set-state-in-effect`). Tagging also makes a stale read harmless: a slow
   * response for a previous function no longer matches `functionFilePath`,
   * so it is ignored rather than rendering the wrong function's identity.
   */
  const [loaded, setLoaded] = useState<
    { path: string; identity: FunctionIdentity | null } | null
  >(null);

  useEffect(() => {
    if (!functionFilePath) return;
    let cancelled = false;

    void filesService.read(functionFilePath).then((res) => {
      if (cancelled) return;
      if (!res.success) {
        setLoaded({ path: functionFilePath, identity: null });
        return;
      }
      try {
        const json = JSON.parse(res.data.content) as Record<string, unknown>;
        // Same normalization the in-editor runner uses: `attributes.scope`
        // falls back to `scope`, defaulting to `'I'`.
        const values = toFunctionMetadataFormValues(json);
        setLoaded({
          path: functionFilePath,
          identity:
            values.domain && values.key
              ? { domain: values.domain, functionKey: values.key, scope: values.scope }
              : null,
        });
      } catch {
        setLoaded({ path: functionFilePath, identity: null });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [functionFilePath]);

  // A result for a previous path reads as "not loaded yet", not as this
  // function's answer.
  const current = loaded?.path === functionFilePath ? loaded : null;
  const identity = current?.identity ?? null;
  const loadError = current?.identity === null;

  useEffect(() => {
    if (!id || !group || !name) return;
    openTab({
      id: functionRunTabId(id, group, name),
      kind: 'functionrun',
      title: `Run: ${name}`,
      group,
      name,
    });
  }, [id, group, name, openTab]);

  if (!id || !group || !name) {
    return null;
  }

  if (loadError) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-center text-sm">
        <p>
          Failed to read function file. Check that the file exists and contains valid &quot;domain&quot;
          and &quot;key&quot; fields.
        </p>
      </div>
    );
  }

  if (!identity) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-center text-sm">
        <p>Loading function...</p>
      </div>
    );
  }

  return (
    <FunctionRunShell
      domain={identity.domain}
      functionKey={identity.functionKey}
      scope={identity.scope}
      runtimeUrl={runtimeUrl}
      projectId={id}
      toolWideHeaders={toolWideHeaders}
      surface="standalone"
    />
  );
}
