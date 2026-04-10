import { useEffect } from 'react';
import { useComponentStore } from '@modules/save-component/ComponentStore';
import { useAsync } from '@shared/hooks/UseAsync';
import { loadFunctionEditor } from './FunctionEditorApi';

interface UseFunctionEditorParams {
  filePath: string | null;
}

export function useFunctionEditor({ filePath }: UseFunctionEditorParams) {
  const setComponent = useComponentStore((state) => state.setComponent);
  const clear = useComponentStore((state) => state.clear);

  const { execute, loading, error, data, reset } = useAsync(loadFunctionEditor, {
    showNotificationOnError: false,
    errorMessage: 'Function could not be loaded.',
    onSuccess: async (result) => {
      if (!result.success) {
        return;
      }

      setComponent(result.data.json, 'function', result.data.filePath);
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
    functionDocument: data,
  };
}
