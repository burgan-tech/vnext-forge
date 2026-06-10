import { useEffect } from 'react';
import { useComponentStore } from '../../store/useComponentStore';
import { useAsync } from '../../hooks/useAsync';
import { loadMappingEditor } from './MappingEditorApi';

interface UseMappingEditorParams {
  filePath: string | null;
}

export function useMappingEditor({ filePath }: UseMappingEditorParams) {
  const setComponent = useComponentStore((state) => state.setComponent);
  const clear = useComponentStore((state) => state.clear);

  const { execute, loading, error, data, reset } = useAsync(loadMappingEditor, {
    showNotificationOnError: false,
    onSuccess: async (result) => {
      if (!result.success) return;
      setComponent(result.data.json, 'mapping', result.data.filePath);
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
    mappingDocument: data,
  };
}
