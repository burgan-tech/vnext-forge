import type { DataSchema, LogLevel, PseudoViewDelegate, ViewDefinition } from '@burgantech/pseudo-ui';

import * as QuickRunApi from '../QuickRunApi';
import type { WorkflowBucketConfig } from '../QuickRunApi';
import { createLogger } from '../../../lib/logger/createLogger';
import { firePseudoUiTransition } from './firePseudoUiTransition';
import { resolveTransitionKey } from './resolveTransitionKey';
import { parseAmorphieUrn } from './parseAmorphieUrn';
import { parseValidationFailure } from './parseValidationFailure';
import { FireTransitionError } from './FireTransitionError';
import type { ResolvedComponentFile } from './resolveComponentFile';

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
  /**
   * R25.B-4 — Workspace-aware loader for nested `Component` nodes.
   * Builder side mounts this via `InstanceDashboard` so simulation
   * can render referenced views inline. When omitted, the delegate
   * falls back to a stubbed empty Column (legacy behaviour) so
   * non-StateView consumers don't have to wire it.
   */
  resolveComponent?: (ref: string) => Promise<ResolvedComponentFile | null>;
}

/**
 * Resolve the command URN/key into a transition name and fire it
 * through the shared `firePseudoUiTransition` helper (header merge
 * + bucket persist + structured validation error surfacing).
 *
 * Called by every dispatch branch in `onAction` that needs to hit
 * the workflow fire endpoint: `submit`, deprecated `transition`,
 * `dispatch + wf-transition / legacy-transition / raw`, and the
 * unknown-verb fallback when a transition URN is present.
 */
async function fireTransitionFromCommand(
  action: string,
  command: string | undefined,
  formData: Record<string, unknown>,
  params: QuickRunDelegateParams,
  runtimeUrl: string | undefined,
): Promise<void> {
  const transitionKey = resolveTransitionKey(command);
  params.verboseLog?.('info', 'Transition fire received', undefined, {
    action,
    command,
    resolvedTransitionKey: transitionKey,
    formData,
  });
  logger.info('[pseudo-ui] Transition fire received', {
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
    throw new FireTransitionError({
      message: result.error.message,
      code: result.error.code,
      validation,
      details: result.error.details,
    });
  }
  await params.onTransitionComplete?.();
}

export function createQuickRunPseudoDelegate(params: QuickRunDelegateParams): PseudoViewDelegate {
  const runtimeUrl = params.runtimeUrl || undefined;

  return {
    requestData: async (ref, reqParams) => {
      // R25.B-2 — `ref` is the SDK-side `LovDefinition.source` /
      // `LookupDefinition.source` (an Amorphie function URN in
      // normal flows). Forge only handles same-domain function URNs;
      // anything else is a no-op so the SDK's empty-array fallback
      // can kick in (per the user's explicit rule: no cross-domain
      // fallback handling).
      const parsed = parseAmorphieUrn(typeof ref === 'string' ? ref : '');
      if (!parsed || parsed.kind !== 'func') {
        logger.warn('[pseudo-ui] requestData: non-function URN ref — not handled.', { ref });
        params.verboseLog?.('warn', 'requestData: non-function URN', undefined, { ref });
        return undefined;
      }
      if (parsed.domain !== params.domain) {
        logger.warn('[pseudo-ui] requestData: cross-domain function URN — not handled.', {
          ref,
          currentDomain: params.domain,
          urnDomain: parsed.domain,
        });
        params.verboseLog?.('warn', 'requestData: cross-domain function URN', undefined, {
          ref,
          currentDomain: params.domain,
          urnDomain: parsed.domain,
        });
        return undefined;
      }

      // The SDK already resolved every `$form.x` / `$instance.x` /
      // `$param.x` filter expression into a flat string map. Forward
      // those to the engine via `executeFunction` as the query.
      const fnParams: Record<string, string> = {};
      if (reqParams) {
        for (const [k, v] of Object.entries(reqParams)) {
          if (typeof v === 'string') fnParams[k] = v;
        }
      }

      params.verboseLog?.('info', 'requestData → executeFunction', undefined, {
        urn: ref,
        urnDomain: parsed.domain,
        function: parsed.function,
        params: fnParams,
      });

      const result = await QuickRunApi.executeFunction({
        domain: params.domain,
        workflowKey: params.workflowKey,
        instanceId: params.instanceId,
        functionUrn: typeof ref === 'string' ? ref : '',
        params: Object.keys(fnParams).length > 0 ? fnParams : undefined,
        headers: params.getSessionHeaders(),
        runtimeUrl,
      });
      if (!result.success) {
        logger.error('[pseudo-ui] requestData engine error', {
          urn: ref,
          error: result.error.message,
        });
        params.verboseLog?.('error', 'requestData engine error', result.error, { urn: ref });
        // Defensive: surface only via log; SDK will fall back to an
        // empty LovItem[] / null lookup so the field renders quietly.
        return undefined;
      }
      return result.data;
    },

    loadComponent: async (ref: string) => {
      // R25.B-4 — When the host supplies `resolveComponent`, route
      // through it (workspace-aware: parseComponentRef + workspace
      // file read for both the nested view and its schema). When
      // omitted (legacy consumers), fall back to an empty Column so
      // the SDK render path doesn't crash on a missing nested view.
      const EMPTY = {
        schema: {} as DataSchema,
        view: {
          $schema: 'https://amorphie.io/meta/view-vocabulary/1.0',
          dataSchema: '',
          view: { type: 'Column' },
        } satisfies ViewDefinition,
      };
      if (!params.resolveComponent) {
        logger.info(`[pseudo-ui] loadComponent: no resolver wired; returning empty placeholder for ref ${ref}`);
        return EMPTY;
      }
      try {
        const resolved = await params.resolveComponent(ref);
        if (!resolved) {
          logger.warn(`[pseudo-ui] loadComponent: workspace miss for ref "${ref}"`);
          params.verboseLog?.('warn', 'loadComponent miss', undefined, { ref });
          return EMPTY;
        }
        params.verboseLog?.('info', 'loadComponent resolved', undefined, { ref });
        return resolved;
      } catch (err) {
        logger.error(`[pseudo-ui] loadComponent failed for ref "${ref}"`, { error: err });
        params.verboseLog?.('error', 'loadComponent error', err, { ref });
        return EMPTY;
      }
    },

    onAction: async (action, formData, command) => {
      // ── Reserved-verb branches (SDK STANDARD_ACTIONS) ─────────────
      // `submit` (canonical) and `transition` (R24 deprecated alias)
      // share the workflow fire path. `reset` notifies the host so
      // it can refresh instance data; SDK has already cleared the
      // form bucket. `select` never reaches the host (SDK handles
      // inline). `back` / `cancel` are free-form conventional verbs
      // — Quick Runner has no router / dialog yet, so they're a
      // no-op + info log.
      if (action === 'submit' || action === 'transition') {
        if (action === 'transition') {
          logger.warn(
            '[pseudo-ui] Deprecated Button.action "transition". Use action="submit" with a transition URN in `command`, or action="dispatch" + urn:amorphie:wf:... See forgeactionmodelintegration.md.',
            { command },
          );
          params.verboseLog?.('warn', 'Deprecated action "transition" — use "submit" or "dispatch" with a URN command', undefined, {
            command,
          });
        }
        await fireTransitionFromCommand(action, command, formData, params, runtimeUrl);
        return;
      }

      if (action === 'reset') {
        logger.info('[pseudo-ui] Reset action — SDK cleared formData/errors; refreshing instance.');
        params.verboseLog?.('info', 'Reset action', undefined, { command });
        // SDK already cleared ctx.formData + ctx.errors. Trigger the
        // same post-transition hook so the host re-polls instance
        // data and any LOV / lookup state currently in flight.
        await params.onTransitionComplete?.();
        return;
      }

      if (action === 'back' || action === 'cancel') {
        logger.info(`[pseudo-ui] ${action} action — no Forge handler wired in StateView`, { command });
        params.verboseLog?.('info', `${action} action (no-op)`, undefined, { command });
        return;
      }

      // ── Domain dispatch (`action: 'dispatch'`) ────────────────────
      // The action verb is opaque to the SDK; the URN in `command`
      // decides where the request goes. We parse and route:
      //   wf-transition / legacy-transition → workflow fire path
      //   func (same-domain only)           → executeFunction (R25.B-1+)
      //   nav                               → no-op (no router yet)
      //   tenant / unknown                  → no-op + warn
      if (action === 'dispatch') {
        const parsed = parseAmorphieUrn(command);
        if (!parsed) {
          const msg = 'Missing or empty command for dispatch';
          params.onError?.(msg);
          throw new Error(msg);
        }
        params.verboseLog?.('info', 'Dispatch action received', undefined, {
          action,
          command,
          urnKind: parsed.kind,
          formData,
        });

        if (parsed.kind === 'wf-transition' || parsed.kind === 'legacy-transition' || parsed.kind === 'raw') {
          await fireTransitionFromCommand(action, command, formData, params, runtimeUrl);
          return;
        }

        if (parsed.kind === 'func') {
          if (parsed.domain !== params.domain) {
            logger.warn('[pseudo-ui] Function URN domain mismatch — not handled.', {
              urn: command,
              currentDomain: params.domain,
              urnDomain: parsed.domain,
            });
            params.verboseLog?.('warn', 'Function URN cross-domain — not handled', undefined, {
              urn: command,
              currentDomain: params.domain,
              urnDomain: parsed.domain,
            });
            return;
          }
          // Forward formData to the engine as the query string —
          // descriptor-style dispatches use the same payload contract
          // as LOV / lookup requestData calls.
          const fnParams: Record<string, string> = {};
          for (const [k, v] of Object.entries(formData ?? {})) {
            if (typeof v === 'string') fnParams[k] = v;
            else if (v != null) fnParams[k] = JSON.stringify(v);
          }
          const result = await QuickRunApi.executeFunction({
            domain: params.domain,
            workflowKey: params.workflowKey,
            instanceId: params.instanceId,
            functionUrn: command!,
            params: Object.keys(fnParams).length > 0 ? fnParams : undefined,
            headers: params.getSessionHeaders(),
            runtimeUrl,
          });
          if (!result.success) {
            params.onError?.(result.error.message);
            logger.error('[pseudo-ui] Function dispatch engine error', {
              urn: command,
              error: result.error.message,
            });
            throw new Error(result.error.message);
          }
          params.verboseLog?.('info', 'Function dispatch ok', undefined, {
            urn: command,
            result: result.data,
          });
          // Trigger the same post-action refresh as a transition so
          // any downstream state / LOV picks up the side effect.
          await params.onTransitionComplete?.();
          return;
        }

        // nav / tenant / unknown
        logger.warn(`[pseudo-ui] Dispatch URN kind "${parsed.kind}" — no Forge handler.`, {
          urn: command,
        });
        params.verboseLog?.('warn', `Dispatch URN kind "${parsed.kind}" — no Forge handler`, undefined, {
          urn: command,
        });
        return;
      }

      // ── Anything else — opaque domain verb. ───────────────────────
      // Try treating it as a fire (same path as submit) if a parseable
      // transition URN is present; otherwise warn-and-bail so the
      // host can later wire its own handler.
      const parsed = parseAmorphieUrn(command);
      if (parsed?.kind === 'wf-transition' || parsed?.kind === 'legacy-transition') {
        logger.info(`[pseudo-ui] Unknown verb "${action}" with transition URN — firing transition.`, { command });
        await fireTransitionFromCommand(action, command, formData, params, runtimeUrl);
        return;
      }

      logger.warn(`[pseudo-ui] Unhandled pseudo-ui action: ${action}`, { command });
      params.verboseLog?.('warn', `Unhandled action verb "${action}"`, undefined, { command });
    },

    /* fireTransitionFromCommand is declared below as a top-level helper
       so the dispatch table above can call it once per branch without
       re-implementing the validation / persist plumbing. */

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
