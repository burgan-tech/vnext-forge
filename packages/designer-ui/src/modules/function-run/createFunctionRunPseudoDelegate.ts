import type { DataSchema, LogLevel, PseudoViewDelegate, ViewDefinition } from '@burgan-tech/pseudo-ui';
import type { FunctionVerb } from '@vnext-forge-studio/vnext-types';

import { createLogger } from '../../lib/logger/createLogger';
import { parseVnextUrn, type FnCommand } from '../quick-run/pseudo-ui/parseVnextUrn';
import { resolveComponentFile, type ResolvedComponentFile } from '../quick-run/pseudo-ui/resolveComponentFile';
import { resolveUrnBindings, type UrnBindingContext } from '../quick-run/pseudo-ui/resolveUrnBindings';

import * as FunctionRunApi from './FunctionRunApi';
import { CONTENT_TYPES } from './functionRunPayload';

const logger = createLogger('function-run-pseudo-ui');

export interface FunctionRunDelegateParams {
  /**
   * Same-domain gate for `x-lov` / `x-lookup` `source` URNs — a cross-domain
   * function URN is refused (returns `undefined`, never thrown), mirroring
   * `createQuickRunPseudoDelegate`'s own policy: Forge does not handle other
   * domains at the delegate layer.
   */
  domain: string;
  /**
   * The current Forge project, when one is active — enables `loadComponent`
   * to resolve nested `Component` view refs from disk via
   * `resolveComponentFile`. Omitted (e.g. today's extension standalone
   * webview, which has no project store) falls back to an empty placeholder,
   * the same degraded behaviour `createQuickRunPseudoDelegate` uses when its
   * own optional `resolveComponent` is not wired.
   */
  projectId?: string;
  /**
   * Live getters — the delegate factory only needs to be recreated when
   * identity-level inputs change (`domain` / `projectId`). Headers and the
   * runtime URL can change on every keystroke (the Headers tab's
   * `KeyValueEditor`) without tearing down the SDK tree, the same reasoning
   * `createQuickRunPseudoDelegate` documents for its own getters.
   */
  getHeaders: () => Record<string, string>;
  getRuntimeUrl: () => string | undefined;
  /**
   * `${dotted.path}` binding context for `x-lov` / `x-lookup` `source` URNs
   * (see `resolveUrnBindings`). The function runner has no polled workflow
   * instance snapshot the way Quick Run's `activeData` does, so `data` and
   * `extensions` are always empty here — the one live source available is
   * the input view's own in-progress form values (`formData`), which
   * `resolveUrnBindings` already tries as a fallback source. This lets a
   * `source` URN reference `${someFieldName}` against whatever the user has
   * typed into the input view so far.
   */
  getBindingContext: () => UrnBindingContext;
  /**
   * Routes the view's own submit button to the shell's single Invoke path —
   * `FunctionRunShell`'s existing `handleInvoke`, which already reads
   * `viewFormData` (kept in sync by `PseudoUiOrJsonBlock`'s `onFormChange`
   * tap) from the store. There is still exactly one place that actually
   * calls `functions/invoke`.
   */
  onSubmit: () => void | Promise<void>;
  /**
   * Optional dev hook mirroring `createQuickRunPseudoDelegate`'s own
   * `verboseLog` — forwarded from every `onLog` call plus this delegate's
   * own diagnostic branches.
   */
  verboseLog?: (level: LogLevel, message: string, error?: unknown, context?: unknown) => void;
}

export interface FunctionUrnInvokePathInput {
  domain: string;
  function: string;
  /** Present together with `instance` for a workflow-scoped (F/I) call. */
  flow?: string;
  instance?: string;
}

/**
 * The invoke-route half of the scope→route rule
 * `buildFunctionInfoPath` owns server-side
 * (`packages/services-core/src/services/function-run/function-run-paths.ts`),
 * minus its `/info` suffix — `designer-ui` may not import `services-core`
 * (see the dependency policy), so this is a deliberate, tested duplicate of
 * that rule rather than a shared import. Same precedent
 * `normalizeRuntimeHrefForDisplay` documents in `functionRunEndpoint.ts` for
 * the display-time half of the same file. Keep all three in step: if the
 * wire shape ever changes server-side, mirror it here too.
 */
export function buildFunctionUrnInvokePath(input: FunctionUrnInvokePathInput): string {
  const { domain, function: fn, flow, instance } = input;
  if (flow && instance) {
    return `/api/v1/${domain}/workflows/${flow}/instances/${instance}/functions/${fn}`;
  }
  return `/api/v1/${domain}/functions/${fn}`;
}

const FN_COMMAND_TO_VERB: Record<FnCommand, FunctionVerb> = {
  get: 'GET',
  post: 'POST',
  patch: 'PATCH',
  delete: 'DELETE',
};

/**
 * Builds a `PseudoViewDelegate` for the Function Quick Runner's rendered
 * input/output views.
 *
 * `createQuickRunPseudoDelegate` cannot be reused here: its params are
 * `workflowKey` + `instanceId` and its action table dispatches workflow
 * transitions, neither of which exists in this runner. This delegate's
 * `requestData` instead routes `x-lov` / `x-lookup` `source` URNs through
 * `FunctionRunApi.invoke` — the same client the shell's own Send button
 * uses — with a path built by `buildFunctionUrnInvokePath` from the URN's
 * own segments (which may name a *different* function than the one the
 * runner is currently loaded for).
 *
 * Every failure path returns `undefined` rather than throwing, so the SDK's
 * existing "no data" fallback (an empty Dropdown/options list) kicks in —
 * the same contract `createQuickRunPseudoDelegate.requestData` documents.
 *
 * `FunctionRunApi.invoke` always resolves — a transport failure is
 * `success: false`, but a 403/500 from the runtime itself still arrives as
 * `success: true` with `data.status` carrying the HTTP code. Both must be
 * treated as "no data": returning `data` unconditionally on `success` would
 * feed an error body (or a non-JSON body) into a dropdown as if it were the
 * list of options.
 */
export function createFunctionRunPseudoDelegate(params: FunctionRunDelegateParams): PseudoViewDelegate {
  return {
    requestData: async (ref, reqParams) => {
      const refString = typeof ref === 'string' ? ref : '';
      if (!refString.trim()) {
        logger.warn('[function-run] requestData: empty ref.');
        params.verboseLog?.('warn', 'requestData: empty ref', undefined, { ref });
        return undefined;
      }

      const { resolved, unresolved } = resolveUrnBindings(refString, params.getBindingContext());
      if (unresolved.length > 0) {
        logger.warn('[function-run] requestData: URN has unresolved bindings.', { ref, unresolved });
        params.verboseLog?.('warn', 'requestData: unresolved bindings', undefined, { ref, unresolved });
        return undefined;
      }

      const parsed = parseVnextUrn(resolved);
      if (!parsed) {
        logger.warn('[function-run] requestData: URN could not be parsed.', { ref });
        params.verboseLog?.('warn', 'requestData: unparseable URN', undefined, { ref });
        return undefined;
      }
      if (parsed.kind !== 'fn') {
        logger.warn('[function-run] requestData: non-function URN ref — not handled.', { ref });
        params.verboseLog?.('warn', 'requestData: non-function URN', undefined, { ref });
        return undefined;
      }
      if (parsed.domain !== params.domain) {
        logger.warn('[function-run] requestData: cross-domain function URN — not handled.', {
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

      // The SDK already resolved every `$form.x` / `$instance.x` / `$param.x`
      // filter expression into a flat string map before calling us — forward
      // those on as the invoke's query/body params.
      const fnParams: Record<string, string> = {};
      if (reqParams) {
        for (const [k, v] of Object.entries(reqParams)) {
          if (typeof v === 'string') fnParams[k] = v;
        }
      }
      const hasParams = Object.keys(fnParams).length > 0;

      const path = buildFunctionUrnInvokePath({
        domain: parsed.domain,
        function: parsed.function,
        flow: parsed.flow,
        instance: parsed.instance,
      });
      const verb = FN_COMMAND_TO_VERB[parsed.command];
      const bodyBearing = verb === 'POST' || verb === 'PATCH';

      params.verboseLog?.('info', 'requestData → functions/invoke', undefined, {
        urn: resolved,
        path,
        verb,
        params: fnParams,
      });

      // Wrapped so a transport / serialization throw can't escape into the
      // SDK's LOV/lookup loader (invoked from React render) — the SDK
      // already treats `undefined` as "no data" and renders an empty
      // Dropdown, the correct fallback for any business/runtime error.
      let result: Awaited<ReturnType<typeof FunctionRunApi.invoke>>;
      try {
        result = await FunctionRunApi.invoke({
          path,
          // `path` is built locally by `buildFunctionUrnInvokePath` and already
          // carries `/api/v1`, so rebasing is a no-op here — passed anyway so
          // every `functions/invoke` call site states its anchor rather than
          // relying on one of them happening not to need it.
          domain: parsed.domain,
          verb,
          query: !bodyBearing && hasParams ? fnParams : undefined,
          body: bodyBearing && hasParams ? JSON.stringify(fnParams) : undefined,
          contentType: bodyBearing && hasParams ? CONTENT_TYPES.json : undefined,
          headers: params.getHeaders(),
          runtimeUrl: params.getRuntimeUrl(),
        });
      } catch (err) {
        logger.error('[function-run] requestData threw', {
          timestamp: new Date().toISOString(),
          urn: resolved,
          error: err instanceof Error ? err.message : String(err),
        });
        params.verboseLog?.('error', 'requestData threw', err, { urn: resolved });
        return undefined;
      }

      if (!result.success) {
        // Transport failure — the function never got to answer.
        logger.error('[function-run] requestData transport failure', {
          timestamp: new Date().toISOString(),
          urn: resolved,
          error: result.error.message,
        });
        params.verboseLog?.('error', 'requestData transport failure', result.error, { urn: resolved });
        return undefined;
      }

      const exchange = result.data;
      if (exchange.status < 200 || exchange.status >= 300) {
        // A 403 (or any non-2xx) arrives here as `success: true` — see this
        // function's own doc comment. Its body is an error payload, not a
        // list of options; it must not reach the SDK as if it were one.
        logger.warn('[function-run] requestData non-2xx response.', {
          urn: resolved,
          status: exchange.status,
        });
        params.verboseLog?.('warn', 'requestData non-2xx response', undefined, {
          urn: resolved,
          status: exchange.status,
        });
        return undefined;
      }
      if (!('json' in exchange) || exchange.jsonParseError) {
        logger.warn('[function-run] requestData response was not usable JSON.', { urn: resolved });
        params.verboseLog?.('warn', 'requestData non-JSON response', undefined, { urn: resolved });
        return undefined;
      }
      return exchange.json;
    },

    loadComponent: async (ref: string) => {
      const EMPTY = {
        schema: {} as DataSchema,
        view: {
          $schema: 'https://amorphie.io/meta/view-vocabulary/1.0',
          dataSchema: '',
          view: { type: 'Column' },
        } satisfies ViewDefinition,
      };
      if (!params.projectId) {
        logger.info(`[function-run] loadComponent: no project context; returning empty placeholder for ref ${ref}`);
        params.verboseLog?.('info', 'loadComponent: no project context', undefined, { ref });
        return EMPTY;
      }
      let resolved: ResolvedComponentFile | null;
      try {
        resolved = await resolveComponentFile({ projectId: params.projectId, ref });
      } catch (err) {
        logger.error(`[function-run] loadComponent failed for ref "${ref}"`, { error: err });
        params.verboseLog?.('error', 'loadComponent error', err, { ref });
        return EMPTY;
      }
      if (!resolved) {
        logger.warn(`[function-run] loadComponent: workspace miss for ref "${ref}"`);
        params.verboseLog?.('warn', 'loadComponent miss', undefined, { ref });
        return EMPTY;
      }
      params.verboseLog?.('info', 'loadComponent resolved', undefined, { ref });
      return resolved;
    },

    onAction: async (
      action,
      _formData,
      command,
      // R26-style pre/post hooks — mirrors `createQuickRunPseudoDelegate`'s
      // own placeholder: the SDK calls the delegate once per phase; until
      // Forge wires real audit/telemetry endpoints, pre/post are no-ops
      // (log only) so the main phase keeps firing without side effects.
      context?: { phase?: 'pre' | 'main' | 'post' },
    ) => {
      if (context?.phase === 'pre' || context?.phase === 'post') {
        logger.info(`[function-run] ${context.phase}-hook (placeholder)`, {
          timestamp: new Date().toISOString(),
          action,
          command,
          phase: context.phase,
        });
        params.verboseLog?.('info', `${context.phase}-hook placeholder`, undefined, { action, command });
        return;
      }

      if (action === 'submit') {
        try {
          await params.onSubmit();
        } catch (err) {
          // Never let an unexpected throw escape the delegate boundary —
          // the runner already surfaces invoke failures through its own
          // `invokeError` state (see `runInvoke`); this is a defensive
          // backstop for a genuine bug in that path, not the expected
          // outcome of a normal invoke failure.
          logger.error('[function-run] submit action threw', {
            timestamp: new Date().toISOString(),
            error: err instanceof Error ? err.message : String(err),
          });
          params.verboseLog?.('error', 'submit action threw', err, { command });
        }
        return;
      }

      // The function runner has no transition/dispatch concept — every
      // other verb (reset, back, cancel, dispatch, …) is logged and
      // otherwise ignored, the same treatment
      // `createQuickRunPseudoDelegate` gives a genuinely unhandled verb.
      logger.warn(`[function-run] Unhandled pseudo-ui action: ${action}`, { command });
      params.verboseLog?.('warn', `Unhandled action verb "${action}"`, undefined, { command });
    },

    onLog: (level, message, error, context) => {
      params.verboseLog?.(level, message, error, context);
      const body = `[function-run pseudo-ui] ${message}`;
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
