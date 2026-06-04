import type { DataSchema, LogLevel, PseudoViewDelegate, ViewDefinition } from '@burgan-tech/pseudo-ui';

import * as QuickRunApi from '../QuickRunApi';
import type { WorkflowBucketConfig } from '../QuickRunApi';
import { createLogger } from '../../../lib/logger/createLogger';
import { firePseudoUiTransition } from './firePseudoUiTransition';
import { resolveTransitionKey } from './resolveTransitionKey';
import { parseVnextUrn, type ParsedVnextUrn } from './parseVnextUrn';
import { resolveUrnBindings, type UrnBindingContext } from './resolveUrnBindings';
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
  /**
   * Snapshot of `instance.data` + `extensions` (plus optional form
   * scratchpad) used by `resolveUrnBindings` to substitute
   * `${path}` placeholders inside URNs before they are parsed.
   * Reading through a getter keeps the closure stable while ensuring
   * every dispatch sees the freshest Data tab payload.
   */
  getBindingContext: () => UrnBindingContext;
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

interface ResolveAndParseSuccess {
  ok: true;
  resolved: string;
  parsed: ParsedVnextUrn;
}

interface ResolveAndParseFailure {
  ok: false;
  reason: 'empty' | 'unresolved' | 'unparseable';
  unresolved?: string[];
  resolved?: string;
}

/**
 * Substitute `${param}` placeholders, then parse. Splitting the two
 * phases keeps the parser pure and centralises the "what does my view
 * actually want me to do?" decision for every dispatch branch.
 */
function resolveAndParse(
  command: string | undefined | null,
  ctx: UrnBindingContext,
): ResolveAndParseSuccess | ResolveAndParseFailure {
  if (typeof command !== 'string' || !command.trim()) {
    return { ok: false, reason: 'empty' };
  }
  const { resolved, unresolved } = resolveUrnBindings(command, ctx);
  if (unresolved.length > 0) {
    return { ok: false, reason: 'unresolved', unresolved, resolved };
  }
  const parsed = parseVnextUrn(resolved);
  if (!parsed) return { ok: false, reason: 'unparseable', resolved };
  return { ok: true, resolved, parsed };
}

/**
 * Resolve the command URN/key into a transition name and fire it
 * through the shared `firePseudoUiTransition` helper (header merge
 * + bucket persist + structured validation error surfacing).
 *
 * Called by every dispatch branch in `onAction` that needs to hit
 * the workflow fire endpoint: `submit`, dispatch + flow-transition,
 * and the unknown-verb fallback when a transition URN is present.
 *
 * The caller is expected to pass the **resolved** command (with
 * `${param}` placeholders already substituted) so `resolveTransitionKey`
 * sees the final URN.
 */
async function fireTransitionFromCommand(
  action: string,
  command: string | undefined,
  formData: Record<string, unknown>,
  params: QuickRunDelegateParams,
  runtimeUrl: string | undefined,
  /** When the URN explicitly carries an instance, use it; otherwise
   *  fall back to the Quick Run's current instance. */
  overrideInstanceId?: string,
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
    logger.error('[pseudo-ui] Missing transition command', {
      timestamp: new Date().toISOString(),
      action,
      command,
    });
    params.onError?.(msg);
    throw new FireTransitionError({
      message: msg,
      code: 'MISSING_COMMAND',
      validation: null,
    });
  }
  const result = await firePseudoUiTransition({
    domain: params.domain,
    workflowKey: params.workflowKey,
    instanceId: overrideInstanceId ?? params.instanceId,
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
      // `ref` is the SDK-side `LovDefinition.source` /
      // `LookupDefinition.source` — a vNext function URN in normal
      // flows. Forge only handles same-domain function URNs;
      // anything else is a no-op so the SDK's empty-array fallback
      // can kick in (per the user's explicit rule: no cross-domain
      // fallback handling).
      const refString = typeof ref === 'string' ? ref : '';
      const lookup = resolveAndParse(refString, params.getBindingContext());
      if (!lookup.ok) {
        logger.warn('[pseudo-ui] requestData: URN could not be resolved/parsed.', {
          ref,
          reason: lookup.reason,
          unresolved: 'unresolved' in lookup ? lookup.unresolved : undefined,
        });
        params.verboseLog?.('warn', 'requestData: URN unresolvable', undefined, { ref, lookup });
        return undefined;
      }
      const parsed = lookup.parsed;
      if (parsed.kind !== 'fn') {
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
      // those to the engine via `executeFunction`.
      const fnParams: Record<string, string> = {};
      if (reqParams) {
        for (const [k, v] of Object.entries(reqParams)) {
          if (typeof v === 'string') fnParams[k] = v;
        }
      }

      params.verboseLog?.('info', 'requestData → executeFunction', undefined, {
        urn: lookup.resolved,
        urnDomain: parsed.domain,
        function: parsed.function,
        command: parsed.command,
        params: fnParams,
      });

      // Wrap in try/catch so a transport / serialization throw
      // can't escape into the SDK's LOV loader (which is invoked
      // from React render). The SDK already treats `undefined` as
      // "no data" and renders an empty Dropdown — that's the desired
      // fallback for any business / runtime error.
      let result: Awaited<ReturnType<typeof QuickRunApi.executeFunction>>;
      try {
        result = await QuickRunApi.executeFunction({
          domain: params.domain,
          workflowKey: params.workflowKey,
          instanceId: params.instanceId,
          functionUrn: lookup.resolved,
          method: parsed.command,
          params: Object.keys(fnParams).length > 0 ? fnParams : undefined,
          headers: params.getSessionHeaders(),
          runtimeUrl,
        });
      } catch (err) {
        logger.error('[pseudo-ui] requestData threw', {
          timestamp: new Date().toISOString(),
          urn: lookup.resolved,
          error: err instanceof Error ? err.message : String(err),
        });
        params.verboseLog?.('error', 'requestData threw', err, { urn: lookup.resolved });
        return undefined;
      }
      if (!result.success) {
        logger.error('[pseudo-ui] requestData engine error', {
          timestamp: new Date().toISOString(),
          urn: lookup.resolved,
          error: result.error.message,
        });
        params.verboseLog?.('error', 'requestData engine error', result.error, {
          urn: lookup.resolved,
        });
        return undefined;
      }
      return result.data;
    },

    loadComponent: async (ref: string) => {
      // R25.B-4 — When the host supplies `resolveComponent`, route
      // through it (workspace-aware: parses the vNext resource URN
      // and reads both the nested view and its schema from disk).
      // When
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

    onAction: async (
      action,
      formData,
      command,
      // R26 — pre/post hooks: the SDK calls the delegate once per
      // phase. `context.phase` is one of 'pre' | 'main' | 'post';
      // legacy callers (no hooks) omit `context` and we treat that as
      // 'main' for back-compat. The signature is declared optional so
      // it stays compatible with the SDK's 3-arg interface — TS
      // tolerates the extra optional positional parameter on the
      // implementation side.
      context?: { phase?: 'pre' | 'main' | 'post' },
    ) => {
      // TODO(hooks): wire pre to an audit endpoint and post to a
      // telemetry endpoint once those services land. Today Forge
      // treats pre/post as a placeholder: the runner just structured-
      // logs the call (with timestamp, action verb, command URN and
      // the snapshot of formData at fire time) and returns. View
      // authors can therefore add hook entries in the editor without
      // crashing Quick Run, and the SDK keeps its pre → main → post
      // sequencing intact.
      if (context?.phase === 'pre' || context?.phase === 'post') {
        logger.info(`[pseudo-ui] ${context.phase}-hook (placeholder)`, {
          timestamp: new Date().toISOString(),
          action,
          command,
          phase: context.phase,
          formData,
        });
        params.verboseLog?.(
          'info',
          `${context.phase}-hook placeholder`,
          undefined,
          { action, command, phase: context.phase },
        );
        return;
      }

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
            '[pseudo-ui] Deprecated Button.action "transition". Use action="submit" with a transition URN in `command`, or action="dispatch" + urn:vnext:flow:transition:...',
            { command },
          );
          params.verboseLog?.('warn', 'Deprecated action "transition" — use "submit" or "dispatch" with a URN command', undefined, {
            command,
          });
        }
        // Submit always fires on the current Quick Run instance — the
        // form's owning view is bound to it. Resolve placeholders so
        // any embedded `${data.*}` references still substitute even
        // though the URN itself usually doesn't carry an instance.
        const submit = resolveAndParse(command, params.getBindingContext());
        if (submit.ok === false && submit.reason === 'unresolved') {
          const msg = `Unresolved bindings: ${submit.unresolved?.join(', ') ?? ''}`;
          logger.error('[pseudo-ui] Submit URN has unresolved placeholders', {
            timestamp: new Date().toISOString(),
            command,
            unresolved: submit.unresolved,
          });
          params.onError?.(msg);
          return;
        }
        const resolvedCommand = submit.ok ? submit.resolved : command;
        await fireTransitionFromCommand(action, resolvedCommand, formData, params, runtimeUrl);
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
      // decides where the request goes. We resolve `${param}`
      // placeholders, parse, and route:
      //   flow-start                        → startInstance
      //   flow-transition                   → fireTransition (with optional
      //                                       URN-carried instance)
      //   fn (same-domain only)             → executeFunction (with verb)
      //   raw                               → treated as a transition key
      //   unknown                           → no-op + warn
      if (action === 'dispatch') {
        const lookup = resolveAndParse(command, params.getBindingContext());
        if (!lookup.ok) {
          let msg = 'Missing or empty command for dispatch';
          if (lookup.reason === 'unresolved') {
            msg = `Unresolved bindings: ${lookup.unresolved?.join(', ') ?? ''}`;
          } else if (lookup.reason === 'unparseable') {
            msg = 'Dispatch command could not be parsed';
          }
          logger.error('[pseudo-ui] Dispatch resolve/parse failed', {
            timestamp: new Date().toISOString(),
            command,
            reason: lookup.reason,
            unresolved: 'unresolved' in lookup ? lookup.unresolved : undefined,
          });
          params.onError?.(msg);
          return;
        }
        const parsed = lookup.parsed;
        params.verboseLog?.('info', 'Dispatch action received', undefined, {
          action,
          command,
          resolvedCommand: lookup.resolved,
          urnKind: parsed.kind,
          formData,
        });

        if (parsed.kind === 'flow-start') {
          if (parsed.domain !== params.domain) {
            logger.warn('[pseudo-ui] flow-start: cross-domain URN — not handled.', {
              urn: lookup.resolved,
              currentDomain: params.domain,
              urnDomain: parsed.domain,
            });
            params.verboseLog?.('warn', 'flow-start cross-domain', undefined, {
              urn: lookup.resolved,
            });
            return;
          }
          // Forward the form payload as initial attributes for the
          // new instance — same contract as the manual "+ New Run"
          // dialog. The host's onTransitionComplete refresh will
          // pick up the new instance through normal polling.
          let result: Awaited<ReturnType<typeof QuickRunApi.startInstance>>;
          try {
            result = await QuickRunApi.startInstance({
              domain: parsed.domain,
              workflowKey: parsed.flow,
              attributes: formData,
              headers: params.getSessionHeaders(),
              runtimeUrl,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Flow start failed';
            logger.error('[pseudo-ui] flow-start threw', {
              timestamp: new Date().toISOString(),
              urn: lookup.resolved,
              error: message,
            });
            params.verboseLog?.('error', 'flow-start threw', err, { urn: lookup.resolved });
            params.onError?.(message);
            return;
          }
          if (!result.success) {
            logger.error('[pseudo-ui] flow-start engine error', {
              timestamp: new Date().toISOString(),
              urn: lookup.resolved,
              error: result.error.message,
            });
            params.onError?.(result.error.message);
            return;
          }
          params.verboseLog?.('info', 'flow-start ok', undefined, {
            urn: lookup.resolved,
            instanceId: result.data.id,
          });
          await params.onTransitionComplete?.();
          return;
        }

        if (parsed.kind === 'flow-transition' || parsed.kind === 'raw') {
          // `raw` keeps the legacy "bare transition key" authoring
          // path alive; `flow-transition` is the canonical vNext
          // form. Both flow through fireTransitionFromCommand which
          // already runs resolveTransitionKey.
          const overrideInstance =
            parsed.kind === 'flow-transition' ? parsed.instance : undefined;
          await fireTransitionFromCommand(
            action,
            lookup.resolved,
            formData,
            params,
            runtimeUrl,
            overrideInstance,
          );
          return;
        }

        if (parsed.kind === 'fn') {
          if (parsed.domain !== params.domain) {
            logger.warn('[pseudo-ui] Function URN domain mismatch — not handled.', {
              urn: lookup.resolved,
              currentDomain: params.domain,
              urnDomain: parsed.domain,
            });
            params.verboseLog?.('warn', 'Function URN cross-domain — not handled', undefined, {
              urn: lookup.resolved,
              currentDomain: params.domain,
              urnDomain: parsed.domain,
            });
            return;
          }
          // Forward formData to the engine — descriptor-style
          // dispatches share the LOV/lookup payload contract. The
          // services-core dispatcher decides query-string vs JSON
          // body based on the HTTP verb.
          const fnParams: Record<string, string> = {};
          for (const [k, v] of Object.entries(formData ?? {})) {
            if (typeof v === 'string') fnParams[k] = v;
            else if (v != null) fnParams[k] = JSON.stringify(v);
          }
          let result: Awaited<ReturnType<typeof QuickRunApi.executeFunction>>;
          try {
            result = await QuickRunApi.executeFunction({
              domain: params.domain,
              workflowKey: params.workflowKey,
              instanceId: params.instanceId,
              functionUrn: lookup.resolved,
              method: parsed.command,
              params: Object.keys(fnParams).length > 0 ? fnParams : undefined,
              headers: params.getSessionHeaders(),
              runtimeUrl,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Function dispatch failed';
            logger.error('[pseudo-ui] Function dispatch threw', {
              timestamp: new Date().toISOString(),
              urn: lookup.resolved,
              error: message,
            });
            params.verboseLog?.('error', 'Function dispatch threw', err, { urn: lookup.resolved });
            params.onError?.(message);
            return;
          }
          if (!result.success) {
            logger.error('[pseudo-ui] Function dispatch engine error', {
              timestamp: new Date().toISOString(),
              urn: lookup.resolved,
              error: result.error.message,
            });
            params.onError?.(result.error.message);
            return;
          }
          params.verboseLog?.('info', 'Function dispatch ok', undefined, {
            urn: lookup.resolved,
            command: parsed.command,
            result: result.data,
          });
          // Trigger the same post-action refresh as a transition so
          // any downstream state / LOV picks up the side effect.
          await params.onTransitionComplete?.();
          return;
        }

        // unknown
        logger.warn(`[pseudo-ui] Dispatch URN kind "${parsed.kind}" — no Forge handler.`, {
          urn: lookup.resolved,
        });
        params.verboseLog?.('warn', `Dispatch URN kind "${parsed.kind}" — no Forge handler`, undefined, {
          urn: lookup.resolved,
        });
        return;
      }

      // ── Anything else — opaque domain verb. ───────────────────────
      // Try treating it as a fire (same path as submit) if a parseable
      // transition URN is present; otherwise warn-and-bail so the
      // host can later wire its own handler.
      const lookup = resolveAndParse(command, params.getBindingContext());
      if (lookup.ok && lookup.parsed.kind === 'flow-transition') {
        logger.info(`[pseudo-ui] Unknown verb "${action}" with transition URN — firing transition.`, { command });
        await fireTransitionFromCommand(
          action,
          lookup.resolved,
          formData,
          params,
          runtimeUrl,
          lookup.parsed.instance,
        );
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
