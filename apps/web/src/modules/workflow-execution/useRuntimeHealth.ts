import { useRuntimeStore } from '@app/store/useRuntimeStore';
import { useAsync } from '@shared/hooks/UseAsync';
import { createLogger } from '@shared/lib/logger/CreateLogger';

import { checkRuntimeHealth } from './WorkflowExecutionApi';
import { useRuntimeRevalidator } from './useRuntimeRevalidator';

const logger = createLogger('useRuntimeHealth');

export function useRuntimeHealth(): void {
  const syncRuntimeHealth = useRuntimeStore((state) => state.syncRuntimeHealth);
  const markRuntimeDisconnected = useRuntimeStore((state) => state.markRuntimeDisconnected);

  const { execute } = useAsync(checkRuntimeHealth, {
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
}
