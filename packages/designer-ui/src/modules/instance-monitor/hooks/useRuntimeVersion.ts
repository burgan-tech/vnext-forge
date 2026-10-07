import { useEffect, useState } from 'react';

import { checkRuntimeHealth } from '../../workflow-execution/WorkflowExecutionApi';

/** The runtime's reported version (`/health`), or null while unknown / unreachable. */
export function useRuntimeVersion(runtimeUrl: string | undefined): string | null {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setVersion(null);
    void checkRuntimeHealth(runtimeUrl)
      .then((res) => {
        if (!cancelled && res.success) setVersion(res.data.version ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [runtimeUrl]);
  return version;
}
