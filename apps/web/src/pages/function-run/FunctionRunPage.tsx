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

  const [identity, setIdentity] = useState<FunctionIdentity | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setIdentity(null);
    setLoadError(false);
    if (!functionFilePath) return;

    void filesService.read(functionFilePath).then((res) => {
      if (!res.success) {
        setLoadError(true);
        return;
      }
      try {
        const json = JSON.parse(res.data.content) as Record<string, unknown>;
        // Same normalization the in-editor runner uses: `attributes.scope`
        // falls back to `scope`, defaulting to `'I'`.
        const values = toFunctionMetadataFormValues(json);
        if (!values.domain || !values.key) {
          setLoadError(true);
          return;
        }
        setIdentity({ domain: values.domain, functionKey: values.key, scope: values.scope });
      } catch {
        setLoadError(true);
      }
    });
  }, [functionFilePath]);

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
    />
  );
}
