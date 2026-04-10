import { useEffect, useMemo } from 'react';
import { useProjectStore } from '@app/store/useProjectStore';
import { useWorkflowStore } from '@app/store/useWorkflowStore';
import { useAsync } from '@shared/hooks/UseAsync';
import { loadFlowEditorDocument } from './FlowEditorApi';

interface UseFlowEditorDocumentOptions {
  group: string;
  name: string;
}

export function useFlowEditorDocument({ group, name }: UseFlowEditorDocumentOptions) {
  const setWorkflow = useWorkflowStore((state) => state.setWorkflow);
  const clearWorkflow = useWorkflowStore((state) => state.clearWorkflow);
  const activeProject = useProjectStore((state) => state.activeProject);
  const fileTree = useProjectStore((state) => state.fileTree);
  const vnextConfig = useProjectStore((state) => state.vnextConfig);

  const paths = useMemo(() => {
    if (!activeProject || !vnextConfig) {
      return null;
    }

    const workflowRoot = `${activeProject.path}/${vnextConfig.paths.componentsRoot}/${vnextConfig.paths.workflows}/${group}`;
    const workflowFilePath = `${workflowRoot}/${name}.json`;
    const diagramFilePath = `${workflowRoot}/.meta/${name}.diagram.json`;

    return {
      workflowFilePath,
      diagramFilePath,
      hasDiagramFile: hasFilePath(fileTree, diagramFilePath),
    };
  }, [activeProject, fileTree, group, name, vnextConfig]);

  const { execute, loading, error, reset } = useAsync(loadFlowEditorDocument, {
    showNotificationOnError: false,
    onSuccess: async (result) => {
      if (!result.success) {
        return;
      }

      setWorkflow(result.data.workflow, result.data.diagram);
    },
  });

  useEffect(() => {
    if (!paths) {
      reset();
      clearWorkflow();
      return;
    }

    clearWorkflow();
    void execute(paths);
  }, [clearWorkflow, execute, paths, reset]);

  return {
    loading: paths ? loading : false,
    error,
  };
}

function hasFilePath(
  node: ReturnType<typeof useProjectStore.getState>['fileTree'],
  targetPath: string,
): boolean {
  if (!node) {
    return false;
  }

  const normalizedTargetPath = targetPath.replace(/\\/g, '/');
  const normalizedNodePath = node.path.replace(/\\/g, '/');

  if (normalizedNodePath === normalizedTargetPath) {
    return true;
  }

  if (!node.children) {
    return false;
  }

  return node.children.some((child) => hasFilePath(child, normalizedTargetPath));
}
