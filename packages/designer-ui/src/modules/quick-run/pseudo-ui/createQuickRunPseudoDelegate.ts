import type { DataSchema, PseudoViewDelegate, ViewDefinition } from '@burgantech/pseudo-ui';

import * as QuickRunApi from '../QuickRunApi';
import { createLogger } from '../../../lib/logger/createLogger';

const logger = createLogger('pseudo-ui');

export interface QuickRunDelegateParams {
  domain: string;
  workflowKey: string;
  instanceId: string;
  runtimeUrl: string;
  headers: Record<string, string>;
  onTransitionComplete?: () => void;
  onError?: (message: string) => void;
}

export function createQuickRunPseudoDelegate(params: QuickRunDelegateParams): PseudoViewDelegate {
  const runtimeUrl = params.runtimeUrl || undefined;

  return {
    requestData: async (ref, reqParams) => {
      const response = await QuickRunApi.getData({
        domain: params.domain,
        workflowKey: params.workflowKey,
        instanceId: params.instanceId,
        extensions: typeof reqParams?.extensions === 'string' ? reqParams.extensions : undefined,
        headers: params.headers,
        runtimeUrl,
      });
      if (!response.success) {
        params.onError?.(response.error.message);
        return undefined;
      }
      return response.data.data;
    },

    loadComponent: (ref: string) => {
      logger.info(`[pseudo-ui] loadComponent stub for ref: ${ref}`);
      return Promise.resolve({
        schema: {} as DataSchema,
        view: {
          $schema: 'https://amorphie.io/meta/view-vocabulary/1.0',
          dataSchema: '',
          view: { type: 'Column' },
        } satisfies ViewDefinition,
      });
    },

    onAction: async (action, formData, command) => {
      if (action === 'back') {
        logger.info('[pseudo-ui] Back action ignored in QuickRunner (no navigation)');
        return;
      }

      if (action === 'submit') {
        const transitionKey = command?.trim();
        if (!transitionKey) {
          const msg = 'Missing transition command';
          params.onError?.(msg);
          throw new Error(msg);
        }

        const result = await QuickRunApi.fireTransition({
          domain: params.domain,
          workflowKey: params.workflowKey,
          instanceId: params.instanceId,
          transitionKey,
          attributes: formData,
          headers: params.headers,
          runtimeUrl,
        });

        if (!result.success) {
          params.onError?.(result.error.message);
          throw new Error(result.error.message);
        }

        params.onTransitionComplete?.();
        return;
      }

      logger.warn(`[pseudo-ui] Unhandled pseudo-ui action: ${action}`, { command });
    },

    onLog: (level, message, error, context) => {
      const body = `[pseudo-ui] ${message}`;
      if (level === 'error') {
        logger.error(body, { error, context });
      } else if (level === 'warn') {
        logger.warn(body, { error, context });
      } else {
        logger.info(body, context);
      }
    },
  };
}
