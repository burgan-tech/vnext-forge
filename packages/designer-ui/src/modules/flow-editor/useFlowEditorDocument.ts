import { useEffect, useMemo } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import { useAsync } from '../../hooks/useAsync';
import { createLogger } from '../../lib/logger/createLogger';
import { ensureDiagramInfrastructure, loadFlowEditorDocument } from './FlowEditorApi';

const logger = createLogger('flow-editor/useFlowEditorDocument');

interface UseFlowEditorDocumentOptions {
  group: string;
  name: string;
}

export function useFlowEditorDocument({ group, name }: UseFlowEditorDocumentOptions) {
  const setWorkflow = useWorkflowStore((state) => state.setWorkflow);
  const clearWorkflow = useWorkflowStore((state) => state.clearWorkflow);
  const activeProject = useProjectStore((state) => state.activeProject);
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
    };
  }, [activeProject, group, name, vnextConfig]);

  const { execute, loading, error, reset } = useAsync(loadFlowEditorDocument, {
    showNotificationOnError: false,
    onSuccess: async (result) => {
      if (!result.success) {
        return;
      }

      setWorkflow(result.data.workflow, result.data.diagram);

      if (paths) {
        void ensureDiagramInfrastructure(paths.diagramFilePath).catch((err) =>
          logger.warn('Failed to ensure diagram infrastructure', err),
        );
      }
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
