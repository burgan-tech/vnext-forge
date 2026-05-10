import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { quickRunTabId, useEditorStore, useProjectStore } from '@vnext-forge-studio/designer-ui';
import {
  QuickRunApi,
  QuickRunShell,
  type DataBucketAdapter,
  type SchemaReference,
  type WorkflowBucketConfig,
} from '@vnext-forge-studio/designer-ui/quickrun';

import { filesService } from '../../services';
import { useEnvironmentStore } from '../../app/store/useEnvironmentStore';
import { useQuickRunSettingsStore } from '../../app/store/useQuickRunSettingsStore';

function quickRunLocalStorageAdapter(): DataBucketAdapter {
  return {
    async save(domain, workflowKey, config) {
      const key = `quickrun-bucket:${domain}:${workflowKey}`;
      try {
        localStorage.setItem(key, JSON.stringify(config));
      } catch {
        /* ignore quota / privacy mode */
      }
    },
    async load(domain, workflowKey) {
      const key = `quickrun-bucket:${domain}:${workflowKey}`;
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as WorkflowBucketConfig;
      } catch {
        return null;
      }
    },
  };
}

export function QuickRunPage() {
  const { id, group, name } = useParams<{ id: string; group: string; name: string }>();
  const openTab = useEditorStore((s) => s.openTab);
  const domain = useProjectStore((s) => s.activeProject?.domain);
  const projectPath = useProjectStore((s) => s.activeProject?.path);
  const vnextConfig = useProjectStore((s) => s.vnextConfig);
  const activeEnv = useEnvironmentStore((s) => s.getActiveEnvironment());
  const pollingRetryCount = useQuickRunSettingsStore((s) => s.polling.retryCount);
  const pollingIntervalMs = useQuickRunSettingsStore((s) => s.polling.intervalMs);

  const workflowFilePath = useMemo(() => {
    if (!projectPath || !vnextConfig?.paths || !group || !name) return null;
    const base = `${projectPath}/${vnextConfig.paths.componentsRoot}/${vnextConfig.paths.workflows}`;
    const dir = group ? `${base}/${group}` : base;
    return `${dir}/${name}.json`.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  }, [projectPath, vnextConfig, group, name]);

  const [workflowKey, setWorkflowKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  // Captured from `attributes.startTransition.schema` of the loaded workflow.
  // NewRunDialog uses it to faker-fill the start payload via the
  // `test-data/generateForSchemaReference` backend method. Optional —
  // workflows without an attached start schema simply skip auto-fill.
  const [startSchemaRef, setStartSchemaRef] = useState<SchemaReference | undefined>(undefined);

  useEffect(() => {
    setWorkflowKey(null);
    setLoadError(false);
    setStartSchemaRef(undefined);
    if (!workflowFilePath) return;

    void filesService.read(workflowFilePath).then((res) => {
      if (!res.success) {
        setLoadError(true);
        return;
      }
      try {
        const json = JSON.parse(res.data.content) as Record<string, unknown>;
        const key = typeof json.key === 'string' ? json.key : null;
        if (key) {
          setWorkflowKey(key);
        } else {
          setLoadError(true);
          return;
        }
        // Pull the start schema reference for the test-data auto-fill.
        const attrs = json.attributes;
        if (attrs && typeof attrs === 'object') {
          const start = (attrs as { startTransition?: unknown }).startTransition;
          if (start && typeof start === 'object') {
            const schema = (start as { schema?: unknown }).schema;
            if (schema && typeof schema === 'object') {
              const ref = schema as Record<string, unknown>;
              if (typeof ref.key === 'string' && typeof ref.version === 'string') {
                setStartSchemaRef({
                  key: ref.key,
                  version: ref.version,
                  ...(typeof ref.flow === 'string' ? { flow: ref.flow } : {}),
                  ...(typeof ref.domain === 'string' ? { domain: ref.domain } : {}),
                });
              }
            }
          }
        }
      } catch {
        setLoadError(true);
      }
    });
  }, [workflowFilePath]);

  useEffect(() => {
    const adapter = quickRunLocalStorageAdapter();
    QuickRunApi.setDataBucketAdapter(adapter);
    return () => {
      QuickRunApi.setDataBucketAdapter(null);
    };
  }, []);

  useEffect(() => {
    if (!id || !group || !name) return;
    openTab({
      id: quickRunTabId(id, group, name),
      kind: 'quickrun',
      title: `Quick Run: ${name}`,
      group,
      name,
    });
  }, [id, group, name, openTab]);

  if (!id || !group || !name) {
    return null;
  }

  if (!domain) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-center text-sm">
        <p>Workflow domain is not available for this project. Open Quick Run from a loaded project.</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-center text-sm">
        <p>Failed to read workflow file. Check that the file exists and contains a valid &quot;key&quot; field.</p>
      </div>
    );
  }

  if (!workflowKey) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-center text-sm">
        <p>Loading workflow...</p>
      </div>
    );
  }

  return (
    <QuickRunShell
      domain={domain}
      workflowKey={workflowKey}
      environmentName={activeEnv?.name}
      environmentUrl={activeEnv?.baseUrl}
      projectPath={workflowFilePath ?? undefined}
      projectId={id}
      {...(startSchemaRef ? { startSchemaRef } : {})}
      pollingRetryCount={pollingRetryCount}
      pollingIntervalMs={pollingIntervalMs}
    />
  );
}
