import { useEffect } from 'react';
import { useComponentStore } from '../../store/useComponentStore';
import { useAsync } from '../../hooks/useAsync';
import { loadAgentEditor } from './AgentEditorApi';

interface UseAgentEditorParams {
  filePath: string | null;
}

export function useAgentEditor({ filePath }: UseAgentEditorParams) {
  const setComponent = useComponentStore((state) => state.setComponent);
  const clear = useComponentStore((state) => state.clear);

  const { execute, loading, error, data, reset } = useAsync(loadAgentEditor, {
    showNotificationOnError: false,
    onSuccess: async (result) => {
      if (!result.success) return;
      setComponent(result.data.json, 'agent', result.data.filePath);
    },
  });

  useEffect(() => {
    if (!filePath) {
      reset();
      clear();
      return;
    }
    clear();
    void execute({ filePath });
  }, [clear, execute, filePath, reset]);

  return {
    loading,
    error,
    agentDocument: data,
  };
}
