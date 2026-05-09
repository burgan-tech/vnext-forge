import { useCallback, useEffect } from 'react';

import { useRuntimeStore } from '../../store/useRuntimeStore';
import { useAsync } from '../../hooks/useAsync';
import { createLogger } from '../../lib/logger/createLogger';

import { checkRuntimeHealth } from './WorkflowExecutionApi';
import { useRuntimeRevalidator } from './useRuntimeRevalidator';

const logger = createLogger('useRuntimeHealth');

export function useRuntimeHealth(): void {
  const runtimeUrl = useRuntimeStore((state) => state.runtimeUrl);
  const syncRuntimeHealth = useRuntimeStore((state) => state.syncRuntimeHealth);
  const markRuntimeDisconnected = useRuntimeStore((state) => state.markRuntimeDisconnected);

  const runHealthCheck = useCallback(
    () => checkRuntimeHealth(runtimeUrl),
    [runtimeUrl],
  );

  const { execute } = useAsync(runHealthCheck, {
    onSuccess: (result) => {
      if (!result.data) {
        markRuntimeDisconnected();
        logger.warn('Runtime health response returned no data.');
        return;
      }

      syncRuntimeHealth(result.data);
    },
    onError: (runtimeError) => {
      markRuntimeDisconnected();
      logger.warn('Runtime health check failed', {
        code: runtimeError.code,
        traceId: runtimeError.traceId,
      });
    },
    showNotificationOnError: false,
  });

  useRuntimeRevalidator(execute, {
    revalidateOnMount: true,
  });

  useEffect(() => {
    void execute();
  }, [runtimeUrl, execute]);
}
