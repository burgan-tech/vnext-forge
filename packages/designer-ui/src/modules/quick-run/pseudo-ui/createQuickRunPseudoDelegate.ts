import type { DataSchema, LogLevel, PseudoViewDelegate, ViewDefinition } from '@burgantech/pseudo-ui';

import * as QuickRunApi from '../QuickRunApi';
import type { WorkflowBucketConfig } from '../QuickRunApi';
import { createLogger } from '../../../lib/logger/createLogger';
import { firePseudoUiTransition } from './firePseudoUiTransition';
import { resolveTransitionKey } from './resolveTransitionKey';
import { parseValidationFailure } from './parseValidationFailure';
import { FireTransitionError } from './FireTransitionError';

const logger = createLogger('pseudo-ui');

export interface QuickRunDelegateParams {
  domain: string;
  workflowKey: string;
  instanceId: string;
  runtimeUrl: string;
  /**
   * Live getters — the delegate factory only runs when identity-level
   * inputs change (domain / workflow / instance). Header maps and
   * bucket config mutate at higher frequency; reading them through
   * refs keeps the closure stable while still picking up the latest
   * values on every action.
   */
  getBucketConfig: () => WorkflowBucketConfig | null;
  getSessionHeaders: () => Record<string, string>;
  persistBucketConfig?: (next: WorkflowBucketConfig) => Promise<void> | void;
  onTransitionComplete?: () => void | Promise<void>;
  onError?: (message: string) => void;
  /**
   * Optional dev hook. When provided, every SDK `onLog` callback is
   * also routed here so a verbose-logging UI (see
   * `useSettingsStore.pseudoUiVerboseLogs`) can stream the raw
   * stream to console / DevTools. Independent of the structured
   * Forge logger (which is still called underneath).
   */
  verboseLog?: (level: LogLevel, message: string, error?: unknown, context?: unknown) => void;
}

export function createQuickRunPseudoDelegate(params: QuickRunDelegateParams): PseudoViewDelegate {
  const runtimeUrl = params.runtimeUrl || undefined;

  return {
    requestData: async (_ref, reqParams) => {
      const sessionHeaders = params.getSessionHeaders();
      const response = await QuickRunApi.getData({
        domain: params.domain,
        workflowKey: params.workflowKey,
        instanceId: params.instanceId,
        extensions: typeof reqParams?.extensions === 'string' ? reqParams.extensions : undefined,
        headers: sessionHeaders,
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

      // SDK vocabulary (view-vocabulary.md:809-834) defines exactly
      // three ButtonAction values: `submit | cancel | back`. The
      // canonical way to fire a workflow transition is:
      //
      //   "action":  "submit"
      //   "command": "urn:amorphie:transition:<dom>:<wf>:<inst>:<name>"
      //
      // Older Amorphie views ship `{ action: 'transition' }` as an
      // ActionDescriptor — non-vocabulary. R24.1 SDK descriptor-
      // forward keeps those JSONs running, but we log a deprecation
      // warn each time so authors migrate to the canonical pattern.
      if (action === 'submit' || action === 'transition') {
        if (action === 'transition') {
          logger.warn(
            '[pseudo-ui] Deprecated Button.action "transition". Use action="submit" with a transition URN in `command` instead. See view-vocabulary.md §Button.',
            { command },
          );
          params.verboseLog?.('warn', 'Deprecated action "transition" — use "submit" + command URN', undefined, {
            command,
          });
        }
        const transitionKey = resolveTransitionKey(command);
        // R24 debug: surface the full submit payload (action keyword,
        // command, resolved transition key, formData) so a developer
        // can confirm what the SDK handed off without DevTools
        // breakpoints. Verbose flag still gates the console mirror;
        // the structured logger receives it either way.
        params.verboseLog?.('info', 'Submit action received', undefined, {
          action,
          command,
          resolvedTransitionKey: transitionKey,
          formData,
        });
        logger.info('[pseudo-ui] Submit action received', {
          action,
          command,
          resolvedTransitionKey: transitionKey,
          formData,
        });
        if (!transitionKey) {
          const msg = 'Missing transition command';
          params.onError?.(msg);
          throw new Error(msg);
        }

        // R24: route the fire through the shared helper so the request
        // shape and persisted-bucket state match the manual
        // TransitionDialog exactly. Headers are merged from the live
        // global / session / per-transition layers; the persisted
        // entry's body.attributes is overwritten with this formData
        // while the rest (key/stage/tags/headers/queryStrings) is
        // preserved.
        const result = await firePseudoUiTransition({
          domain: params.domain,
          workflowKey: params.workflowKey,
          instanceId: params.instanceId,
          transitionKey,
          formData,
          bucketConfig: params.getBucketConfig(),
          sessionHeaders: params.getSessionHeaders(),
          runtimeUrl,
          persist: params.persistBucketConfig,
          onPersistError: (err) => {
            logger.warn('[pseudo-ui] Bucket persist failed; transition already fired', {
              error: err instanceof Error ? err.message : err,
              transitionKey,
            });
          },
        });

        if (!result.success) {
          const validation = parseValidationFailure(result.error);
          params.onError?.(result.error.message);
          // R24.5 — Surface structured engine validation errors
          // (path / label / message per field) through the delegate
          // boundary so the surface layer can render them in the
          // alert banner instead of a generic message.
          throw new FireTransitionError({
            message: result.error.message,
            code: result.error.code,
            validation,
            details: result.error.details,
          });
        }

        await params.onTransitionComplete?.();
        return;
      }

      logger.warn(`[pseudo-ui] Unhandled pseudo-ui action: ${action}`, { command });
    },

    onLog: (level, message, error, context) => {
      // Forward to the optional verbose console stream first so the
      // dev sees everything in source order. The structured logger
      // still gets every entry below.
      params.verboseLog?.(level, message, error, context);

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
