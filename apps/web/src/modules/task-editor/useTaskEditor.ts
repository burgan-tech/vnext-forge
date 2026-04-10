import { useEffect } from 'react';
import { useComponentStore } from '@app/store/useComponentStore';
import { useAsync } from '@shared/hooks/UseAsync';
import { loadTaskEditor } from './TaskEditorApi';

interface UseTaskEditorParams {
  filePath: string | null;
}

export function useTaskEditor({ filePath }: UseTaskEditorParams) {
  const setComponent = useComponentStore((state) => state.setComponent);
  const clear = useComponentStore((state) => state.clear);
  const componentJson = useComponentStore((state) => state.componentJson);
  const componentFilePath = useComponentStore((state) => state.filePath);

  const { execute, loading, error, data, reset } = useAsync(loadTaskEditor, {
    showNotificationOnError: false,
    errorMessage: 'Task could not be loaded.',
    onSuccess: async (result) => {
      if (!result.success) {
        return;
      }

      setComponent(result.data.json, 'task', result.data.filePath);
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
    taskDocument: data,
    isReady: Boolean(componentJson && componentFilePath === filePath && data),
  };
}
