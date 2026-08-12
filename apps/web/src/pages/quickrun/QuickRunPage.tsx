import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  functionRunInstanceTabId,
  quickRunTabId,
  showNotification,
  useEditorStore,
  useProjectStore,
} from '@vnext-forge-studio/designer-ui';
import {
  QuickRunApi,
  QuickRunShell,
  type DataBucketAdapter,
  type OpenFunctionRunTarget,
  type OpenSubFlowTarget,
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
  const navigate = useNavigate();
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
    // `_` is the route placeholder for a workflow that sits directly under the
    // workflows root (see `FlowEditorPage.onNavigateToWorkflow`) — it is not a
    // real folder, so it must not end up in the path.
    const folder = group === '_' ? '' : group;
    const dir = folder ? `${base}/${folder}` : base;
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

  /**
   * Open one of the running instance's functions in the Function Quick
   * Runner, as its own editor tab. Mirrors `FlowEditorPage.onOpenQuickRun`:
   * designer-ui raises the intent, the web shell turns it into a route.
   */
  const openFunctionRun = useCallback(
    (target: OpenFunctionRunTarget) => {
      if (!id) return;
      const search = new URLSearchParams({
        scope: target.scope,
        workflowKey: target.workflowKey,
        instanceId: target.instanceId,
      }).toString();
      openTab({
        id: functionRunInstanceTabId(id, target.domain, target.functionKey),
        kind: 'functionrun-instance',
        title: `Run: ${target.functionKey}`,
        group: target.domain,
        name: target.functionKey,
        search,
      });
      navigate(
        `/project/${id}/function-run-instance/${encodeURIComponent(target.domain)}/${encodeURIComponent(
          target.functionKey,
        )}?${search}`,
      );
    },
    [id, openTab, navigate],
  );

  /**
   * Open the sub-flow behind a correlation. `designer-ui` has already resolved
   * the workflow file; the web shell only needs the route coordinates it
   * derived from the workspace config.
   */
  const openSubFlowTarget = useCallback(
    (target: OpenSubFlowTarget) => {
      if (!id) return;
      if (!target.route) {
        showNotification({
          message: 'Workspace configuration is not loaded yet. Try again once the project finishes loading.',
          kind: 'warning',
        });
        return;
      }
      // `_` stands in for a workflow directly under the workflows root, the
      // same placeholder `FlowEditorPage.onNavigateToWorkflow` uses.
      const routeGroup = target.route.group || '_';
      const routeName = target.route.name;
      // Both destinations register their own editor tab on mount (this page
      // for Quick Run, `useRegisterComponentEditorTab` for the flow editor),
      // so navigating is enough.
      const section = target.intent === 'designer' ? 'flow' : 'quickrun';
      navigate(
        `/project/${id}/${section}/${encodeURIComponent(routeGroup)}/${encodeURIComponent(routeName)}`,
      );
    },
    [id, navigate],
  );

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
      onOpenFunctionRun={openFunctionRun}
      onOpenSubFlowTarget={openSubFlowTarget}
    />
  );
}
