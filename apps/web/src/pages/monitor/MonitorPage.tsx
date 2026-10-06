import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  monitorTabId,
  showNotification,
  useEditorStore,
  useProjectStore,
  useToolHeadersStore,
} from '@vnext-forge-studio/designer-ui';
import { MonitorShell, type OpenComponentTarget, type OpenInstanceMonitorTarget } from '@vnext-forge-studio/designer-ui/monitor';

import { useEnvironmentStore } from '../../app/store/useEnvironmentStore';
import { resolveFileRoute } from '../../modules/project-workspace/FileRouter';
import { filesService } from '../../services';
import { workflowFilePathFor } from '../quickrun/workflowFilePath';

/** Instance Monitor as an editor tab, opened from Quick Run's Monitor button. */
export function MonitorPage() {
  const { id, group, name, instanceId } = useParams<{
    id: string;
    group: string;
    name: string;
    instanceId: string;
  }>();
  const navigate = useNavigate();
  const openTab = useEditorStore((s) => s.openTab);
  const activeProject = useProjectStore((s) => s.activeProject);
  const vnextConfig = useProjectStore((s) => s.vnextConfig);
  const activeEnv = useEnvironmentStore((s) => s.getActiveEnvironment());
  const headers = useToolHeadersStore((s) => s.headers);

  const workflowFilePath = workflowFilePathFor(
    activeProject?.path,
    vnextConfig?.paths,
    group,
    name,
  );
  const domain = activeProject?.domain;

  // The file name does not always equal the workflow key, so read the key
  // from the file the same way Quick Run does.
  const [workflowKey, setWorkflowKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setWorkflowKey(null);
    setLoadError(false);
    if (!workflowFilePath) return;
    let cancelled = false;
    void filesService
      .read(workflowFilePath)
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          setLoadError(true);
          return;
        }
        try {
          const json = JSON.parse(res.data.content) as Record<string, unknown>;
          if (typeof json.key === 'string' && json.key) {
            setWorkflowKey(json.key);
          } else {
            setLoadError(true);
          }
        } catch {
          setLoadError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [workflowFilePath]);

  useEffect(() => {
    if (!id || !group || !name || !instanceId) return;
    openTab({
      id: monitorTabId(id, instanceId),
      kind: 'monitor',
      title: `Monitor: ${name} · ${instanceId.slice(0, 8)}`,
      group,
      name,
      search: instanceId,
    });
  }, [id, group, name, instanceId, openTab]);

  const target = useMemo(
    () =>
      domain && workflowKey && instanceId && id
        ? {
            domain,
            workflowKey,
            instanceId,
            projectId: id,
            ...(workflowFilePath ? { workflowFilePath } : {}),
            ...(activeEnv?.name ? { environmentName: activeEnv.name } : {}),
            ...(activeEnv?.baseUrl ? { runtimeUrl: activeEnv.baseUrl } : {}),
          }
        : null,
    [domain, workflowKey, instanceId, id, workflowFilePath, activeEnv?.name, activeEnv?.baseUrl],
  );

  const openFile = useCallback(
    (filePath: string) => {
      if (!id || !activeProject) return;
      const route = resolveFileRoute(filePath, vnextConfig, id, activeProject.path);
      navigate(route.navigateTo ?? `/project/${id}/code/${encodeURIComponent(filePath)}`);
    },
    [id, activeProject, vnextConfig, navigate],
  );

  const openInstanceMonitor = useCallback(
    (t: OpenInstanceMonitorTarget) => {
      const route =
        t.workflowFilePath && activeProject
          ? resolveFileRoute(t.workflowFilePath, vnextConfig, id ?? '', activeProject.path)
          : null;
      if (route?.type === 'workflow' && route.group && route.name && id) {
        navigate(
          `/project/${id}/monitor/${encodeURIComponent(route.group)}/${encodeURIComponent(route.name)}/${encodeURIComponent(t.instanceId)}`,
        );
        return;
      }
      showNotification({
        kind: 'warning',
        message:
          "The workflow of this instance is not in this workspace, so it can't open in its own monitor.",
      });
    },
    [id, activeProject, vnextConfig, navigate],
  );

  if (!domain || !workflowFilePath) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-center text-sm">
        <p>Open the monitor from Quick Run in a loaded project.</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-center text-sm">
        <p>
          Failed to read workflow file. Check that the file exists and contains a valid
          &quot;key&quot; field.
        </p>
      </div>
    );
  }

  if (!target) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-center text-sm">
        <p>Loading workflow...</p>
      </div>
    );
  }

  return (
    <MonitorShell
      target={target}
      headers={headers}
      onOpenComponent={(t: OpenComponentTarget) => openFile(t.filePath)}
      onOpenScript={(path) => navigate(`/project/${id}/code/${encodeURIComponent(path)}`)}
      onOpenQuickRun={(instanceId, isRoot) =>
        navigate(
          `/project/${id}/quickrun/${encodeURIComponent(group!)}/${encodeURIComponent(name!)}${
            isRoot ? `?instance=${encodeURIComponent(instanceId)}` : ''
          }`,
        )
      }
      onOpenFlowDesigner={() => openFile(workflowFilePath)}
      onOpenInstanceMonitor={openInstanceMonitor}
    />
  );
}
