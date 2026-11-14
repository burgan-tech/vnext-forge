import { useEffect } from 'react';
import { useComponentStore } from '../../store/useComponentStore';
import { useAsync } from '../../hooks/useAsync';
import { loadAgentEditor } from './AgentEditorApi';
import { setInstructionsCode } from './agentInstructionsFile';

interface UseAgentEditorParams {
  filePath: string | null;
}

export function useAgentEditor({ filePath }: UseAgentEditorParams) {
  const setComponent = useComponentStore((state) => state.setComponent);
  const clear = useComponentStore((state) => state.clear);
  const updateComponent = useComponentStore((state) => state.updateComponent);

  const { execute, loading, error, data, reset } = useAsync(loadAgentEditor, {
    showNotificationOnError: false,
    onSuccess: (result) => {
      if (result.success) {
        setComponent(result.data.json, 'agent', result.data.filePath);
        const fromFile = result.data.instructionsFromFile;
        // The file is the source of `instructions.code`; adopting it marks the
        // document dirty so the next save writes the re-encoded copy.
        if (fromFile) updateComponent((draft) => setInstructionsCode(draft, fromFile.text));
      }
      return Promise.resolve();
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
