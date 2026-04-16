import { useEffect, useRef } from 'react';
import type { ApiResponse } from '@vnext-forge/app-contracts';
import { useAsync } from '@shared/hooks/useAsync';
import { useComponentStore } from '../../app/store/useComponentStore';
import type { ComponentFileDocument } from './SaveComponentApi';

interface UseLoadComponentParams<TArgs> {
  filePath: string | null;
  componentType: string;
  loadComponent: (args: TArgs) => Promise<ApiResponse<ComponentFileDocument>>;
  createArgs: (filePath: string) => TArgs;
  errorMessage: string;
}

export function useLoadComponent<TArgs>({
  filePath,
  componentType,
  loadComponent,
  createArgs,
  errorMessage,
}: UseLoadComponentParams<TArgs>) {
  const setComponent = useComponentStore((state) => state.setComponent);
  const clear = useComponentStore((state) => state.clear);
  const componentJson = useComponentStore((state) => state.componentJson);
  const componentFilePath = useComponentStore((state) => state.filePath);
  const createArgsRef = useRef(createArgs);

  createArgsRef.current = createArgs;

  const { execute, loading, error, data, reset } = useAsync(loadComponent, {
    showNotificationOnError: false,
    errorMessage,
    onSuccess: async (result) => {
      if (!result.success) {
        return;
      }

      setComponent(result.data.json, componentType, result.data.filePath);
    },
  });

  useEffect(() => {
    if (!filePath) {
      reset();
      clear();
      return;
    }

    clear();
    void execute(createArgsRef.current(filePath));
  }, [clear, execute, filePath, reset]);

  return {
    loading,
    error,
    componentDocument: data,
    isReady: Boolean(componentJson && componentFilePath === filePath && data),
  };
}
