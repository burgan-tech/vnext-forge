/**
 * Pseudo-ui view surface — owns chrome (skeleton, error boundary, action
 * state, success flash) and mounts the actual pseudo-ui render inside an
 * isolation iframe via `PseudoUiPseudoViewFrame`.
 *
 * R6 (iframe cascade sandbox): Parent shell Tailwind preflight, designer-ui
 * unlayered resets (`* { outline:none }`, etc.), and VS Code webview's
 * injected `!important` form-control styles all reached native elements
 * pseudo-ui renders. Patch-over-patch CSS could not seal every leak.
 *
 * R6 moves pseudo-ui DOM into a same-origin `<iframe srcdoc>` — separate
 * cascade, `<head>` and portal target. JS stays in one heap so delegate,
 * formData, schema all flow as plain props/refs (no postMessage). Chrome
 * stays in parent DOM with Tailwind because it integrates with the VS
 * Code shell and renders no pseudo-ui-shaped controls.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DataSchema, PseudoViewDelegate, ViewDefinition } from '@burgan-tech/pseudo-ui';
import type { DesignerClassNames, DesignerMode } from '@burgan-tech/pseudo-ui/react';

import type { ViewResponse } from '../types/quickrun.types';
import type { SchemaResolver } from './createDataSchemaResolver';
import { normalizePseudoUiPayload } from './normalizePseudoUiPayload';
import { PseudoUiErrorBoundary, type PseudoUiErrorAction } from './PseudoUiErrorBoundary';
import { PseudoUiPseudoViewFrame } from './PseudoUiPseudoViewFrame';
import { CopyableJsonBlock } from '../components/CopyableJsonBlock';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { FireTransitionError } from './FireTransitionError';
import type { ParsedValidationFailure } from './parseValidationFailure';
import { createLogger } from '../../../lib/logger/createLogger';

const surfaceLogger = createLogger('pseudo-ui-surface');

const noopDelegate: PseudoViewDelegate = {
  requestData: () => Promise.resolve(undefined),
  loadComponent: () =>
    Promise.resolve({
      schema: {} as DataSchema,
      view: { $schema: '', dataSchema: '', view: { type: 'Column' } } satisfies ViewDefinition,
    }),
  onAction: () => Promise.resolve(undefined),
};

function isPayloadEmpty(content: string | Record<string, unknown>): boolean {
  if (typeof content === 'string') return content.trim() === '';
  return Object.keys(content).length === 0;
}

function LoadingSkeleton() {
  return (
    <div
      className="flex flex-col gap-2 p-1 motion-reduce:animate-none"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="h-3 w-1/3 rounded bg-[var(--vscode-editor-inactiveSelectionBackground)] motion-safe:animate-pulse" />
      <div className="h-8 w-full rounded bg-[var(--vscode-editor-inactiveSelectionBackground)] motion-safe:animate-pulse" />
      <div className="h-8 w-full rounded bg-[var(--vscode-editor-inactiveSelectionBackground)] motion-safe:animate-pulse" />
      <div className="h-8 w-2/3 rounded bg-[var(--vscode-editor-inactiveSelectionBackground)] motion-safe:animate-pulse" />
    </div>
  );
}

export interface PseudoUiViewSurfaceProps {
  viewResponse: ViewResponse;
  schema?: DataSchema;
  resolveSchema?: SchemaResolver;
  instanceData?: Record<string, unknown>;
  initialFormData?: Record<string, unknown>;
  /**
   * Render language passed to the SDK. Drives multi-lang
   * `textContent` resolution (`{ en, tr, ar, … } → string`).
   *
   * When omitted (the usual case) the surface reads
   * `useSettingsStore.pseudoUiLang` — that's the single setting
   * users change from the sidebar's Pseudo UI section. Explicit
   * prop wins so individual views (e.g. a Builder preview that
   * wants to demonstrate a non-default locale) can override.
   */
  lang?: string;
  delegate?: PseudoViewDelegate;
  onError?: (message: string) => void;
  mode: 'simulation' | 'preview';
  ariaLabel: string;
  loading?: boolean;
  fillHeight?: boolean;
  className?: string;
  /** Extra escape-hatch buttons rendered in the error boundary (e.g.
   *  "Edit as JSON" from View Editor). Quick Runner can omit. */
  errorActions?: PseudoUiErrorAction[];
  /**
   * SDK designer-mode flag — accepts the legacy boolean form *or* the
   * v0.1.5+ enum (`'off' \| 'preview' \| 'edit'`).
   *
   * - `'off'` / `false` — normal runtime render (Quick Runner).
   * - `'preview'` / `true` — designer semantics ON but no editor chrome:
   *     `ForEach` renders once with an empty `$item`, `x-conditional`
   *     visibility bypassed. Builder Preview tab uses this.
   * - `'edit'` — full editor canvas: node outlines, delete button,
   *     HTML5 drag-drop, selection callbacks. Builder Canvas uses this
   *     with a delegate wired to the builder store.
   *
   * Defaults to `mode === 'preview'` (legacy boolean true) when omitted.
   */
  designer?: boolean | DesignerMode;
  /**
   * SDK `<PseudoView selectedNodePath={...}>` — JSON Pointer string of
   * the currently-selected node (Builder selection mirror). Has effect
   * only in `designer="edit"` mode; ignored otherwise.
   */
  selectedNodePath?: string;
  /**
   * SDK `<PseudoView designerClassNames={...}>` — full override of the
   * designer chrome CSS class names. Forge keeps the SDK defaults and
   * themes them via `--pseudo-designer-*` tokens (see
   * `theme/designerChrome.css`). Provided here for advanced
   * customization escape hatches.
   */
  designerClassNames?: DesignerClassNames;
}

export function PseudoUiViewSurface({
  viewResponse,
  schema: schemaProp,
  resolveSchema,
  instanceData,
  initialFormData,
  lang: langProp,
  delegate,
  onError,
  mode,
  ariaLabel,
  loading = false,
  fillHeight = false,
  className,
  errorActions,
  designer,
  selectedNodePath,
  designerClassNames,
}: PseudoUiViewSurfaceProps) {
  const effectiveDesigner: boolean | DesignerMode = designer ?? mode === 'preview';
  const baseDelegate = delegate ?? noopDelegate;

  // R20: settings-driven render language. Explicit `lang` prop wins;
  // otherwise read from the persisted Pseudo UI settings (default 'tr').
  // Subscribing here lets the surface re-render live as the user
  // switches language from the sidebar without remounting anywhere.
  const settingsLang = useSettingsStore((s) => s.pseudoUiLang);
  const lang = langProp ?? settingsLang;

  const [definitionRetry, setDefinitionRetry] = useState(0);
  const [boundaryReset, setBoundaryReset] = useState(0);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // R24.5 — engine-side per-field validation errors. Populated when
  // the delegate throws a FireTransitionError with a parsed
  // `validation` payload; cleared on every new action attempt.
  const [actionFieldErrors, setActionFieldErrors] = useState<
    ParsedValidationFailure['fieldErrors'] | null
  >(null);
  const [successFlash, setSuccessFlash] = useState(false);
  const [resolvedSchema, setResolvedSchema] = useState<DataSchema | null>(null);
  const [schemaResolving, setSchemaResolving] = useState(false);
  // R26 — tri-state guard. `resolvedSchema === null` is ambiguous on
  // its own: it can mean either "haven't tried yet" OR "tried and
  // came back empty" (URN miss, parse failure, engine 404). The
  // skeleton gate was reading the second case as the first and
  // pinning the View panel on "Loading…" forever. Track whether the
  // resolve attempt has finished so we can let the SDK mount with
  // an empty `{}` schema in the legitimate-miss case (degraded but
  // visible — the user can still see the view structure and fix
  // the URN).
  const [schemaResolutionAttempted, setSchemaResolutionAttempted] = useState(false);
  const successFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successFlashTimerRef.current) clearTimeout(successFlashTimerRef.current);
    };
  }, []);

  // R6: body-portal refcount removed. PrimeReact overlays now mount to the
  // iframe's `document.body` (PrimeReact 10 portal target follows the
  // ownerDocument of its parent provider). The cascade isolation is
  // structural, not selector-based, so no body data-attribute is needed.

  const wrappedDelegate = useMemo((): PseudoViewDelegate => {
    return {
      requestData: (...args) => baseDelegate.requestData(...args),
      loadComponent: (...args) => baseDelegate.loadComponent(...args),
      onLog: baseDelegate.onLog ? (...args) => baseDelegate.onLog!(...args) : undefined,
      onValidationRequest: baseDelegate.onValidationRequest
        ? (...args) => baseDelegate.onValidationRequest!(...args)
        : undefined,
      // R11: forward SDK designer-mode callbacks. Without these the
      // SDK's `delegate.onNodeSelect / onNodeDelete / onNodeMove /
      // onNodeDropFromPalette / onNodeHover` invocations would land on
      // the noop default and the canvas would feel "frozen" — clicks
      // and × buttons paint outlines but never reach the builder
      // store.
      onNodeSelect: baseDelegate.onNodeSelect
        ? (...args) => baseDelegate.onNodeSelect!(...args)
        : undefined,
      onNodeHover: baseDelegate.onNodeHover
        ? (...args) => baseDelegate.onNodeHover!(...args)
        : undefined,
      onNodeDelete: baseDelegate.onNodeDelete
        ? (...args) => baseDelegate.onNodeDelete!(...args)
        : undefined,
      onNodeMove: baseDelegate.onNodeMove
        ? (...args) => baseDelegate.onNodeMove!(...args)
        : undefined,
      onNodeDropFromPalette: baseDelegate.onNodeDropFromPalette
        ? (...args) => baseDelegate.onNodeDropFromPalette!(...args)
        : undefined,
      onAction: async (action, formData, command) => {
        setActionError(null);
        setActionFieldErrors(null);
        if (action === 'submit') {
          setActionPending(true);
        }
        try {
          await baseDelegate.onAction(action, formData, command);
          if (action === 'submit') {
            if (successFlashTimerRef.current) clearTimeout(successFlashTimerRef.current);
            setSuccessFlash(true);
            successFlashTimerRef.current = setTimeout(() => {
              setSuccessFlash(false);
              successFlashTimerRef.current = null;
            }, 2200);
          }
        } catch (e) {
          // R24.5 — preserve the typed FireTransitionError so the
          // banner can render per-field validation rows. Otherwise
          // fall back to the plain message.
          if (e instanceof FireTransitionError) {
            setActionError(e.message);
            setActionFieldErrors(e.validation?.fieldErrors ?? null);
            onError?.(e.message);
          } else {
            const msg = e instanceof Error ? e.message : 'Action failed';
            setActionError(msg);
            onError?.(msg);
          }
        } finally {
          if (action === 'submit') {
            setActionPending(false);
          }
        }
      },
    };
  }, [baseDelegate, onError]);

  const normalized = useMemo(
    () => normalizePseudoUiPayload(viewResponse.content),
    [viewResponse.content, definitionRetry],
  );

  // Clear any stale render errors whenever the view definition changes so
  // the user gets a fresh attempt without manually clicking Retry.
  useEffect(() => {
    setBoundaryReset((n) => n + 1);
  }, [normalized]);

  useEffect(() => {
    // Skip if explicit schema prop is provided (non-empty object)
    if (schemaProp && Object.keys(schemaProp).length > 0) {
      setSchemaResolving(false);
      setSchemaResolutionAttempted(true);
      return;
    }
    // Skip if no dataSchema reference or no resolver — there's
    // nothing to resolve, so the SDK should mount immediately with
    // `{}`.
    if (!normalized?.dataSchema || !resolveSchema) {
      setSchemaResolving(false);
      setSchemaResolutionAttempted(true);
      return;
    }

    let cancelled = false;
    setSchemaResolving(true);
    setSchemaResolutionAttempted(false);
    void resolveSchema(normalized.dataSchema)
      .then((result) => {
        if (!cancelled) setResolvedSchema(result);
      })
      .catch(() => {
        if (!cancelled) setResolvedSchema(null);
      })
      .finally(() => {
        if (!cancelled) {
          setSchemaResolving(false);
          setSchemaResolutionAttempted(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [normalized?.dataSchema, resolveSchema, schemaProp]);

  const schema: DataSchema =
    schemaProp && Object.keys(schemaProp).length > 0
      ? schemaProp
      : (resolvedSchema ?? ({} as DataSchema));

  /**
   * R22.2: gate the SDK mount on schema readiness.
   *
   * `<PseudoView>` creates its form context with
   * `useRef(createFormContext(schema, ...))` — the ref runs once
   * on mount. If we mount with the fallback `{}` first and only
   * later receive the resolved schema, the form context (and every
   * downstream `getSchemaProperty(ctx.schema, bind)` call) keeps
   * pointing at the empty schema and enum-driven inputs (Dropdown
   * / RadioGroup / SegmentedButton) render with zero options.
   *
   * The SDK's React sample (`samples/react-pseudo-ui/src/App.tsx`)
   * sidesteps this by gating render on `editorSchema && editorView`.
   * We mirror that pattern: when the view declares an async
   * dataSchema URN, hold off the SDK mount until `resolvedSchema`
   * is in. Views that ship with an inline `schemaProp` or that
   * don't reference a dataSchema at all still render immediately
   * with the existing `{}` fallback — the surface keeps rendering
   * the view even when no schema is available, the gate only
   * applies to the in-flight async case.
   *
   * `schemaResolving` already covers the in-flight portion of the
   * race, but it starts as `false` on first render — without this
   * extra `expectingAsyncSchema` check the very first mount would
   * still flash through with the empty fallback before the effect
   * fires.
   */
  const expectingAsyncSchema =
    (!schemaProp || Object.keys(schemaProp).length === 0) &&
    typeof resolveSchema === 'function' &&
    typeof normalized?.dataSchema === 'string' &&
    normalized.dataSchema.length > 0;
  // Only hold off the SDK mount while the **initial** resolution
  // attempt is in flight. Once `schemaResolutionAttempted` flips
  // true the result is in (success or null) — null lets the SDK
  // mount with `{}` and the user keeps a visible / editable view
  // instead of an infinite skeleton.
  const schemaNotReady =
    expectingAsyncSchema && !schemaResolutionAttempted && resolvedSchema === null;

  // R23: the `schemaNotReady` gate above keeps the SDK Frame from
  // mounting with a stub `{}` schema. The earlier `schemaRemountKey`
  // belt-and-suspenders fix — which forced a Frame remount whenever
  // schema identity changed — turned out to be the source of the
  // "Attempted to synchronously unmount a root while React was
  // already rendering" console error: a key change during the same
  // commit that resolved the schema asked React to tear down the
  // shadow root mid-render. With the gate in place the very first
  // SDK mount already sees the real schema, so no remount cue is
  // needed. The SDK's own React sample is structured the same way
  // (gate-only, no `key=`).

  const viewDefinition = useMemo((): ViewDefinition | null => {
    if (!normalized) return null;
    return {
      $schema: normalized.$schema ?? 'https://amorphie.io/meta/view-vocabulary/1.0',
      dataSchema: normalized.dataSchema ?? schema.$id ?? '',
      lookups: normalized.lookups,
      uiState: normalized.uiState,
      view: normalized.component,
    };
  }, [normalized, schema.$id]);

  const payloadEmpty = isPayloadEmpty(viewResponse.content);
  const invalidDefinition = viewDefinition === null && !payloadEmpty;

  const [formData, setFormData] = useState<Record<string, unknown>>(initialFormData ?? {});

  useEffect(() => {
    if (initialFormData) setFormData(initialFormData);
  }, [initialFormData]);

  const hostClassName = [
    'pseudo-ui-host',
    `pseudo-ui-host--${mode}`,
    fillHeight ? 'pseudo-ui-host--fill' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  // R26 — View Designer (mode === 'preview') NEVER renders the
  // loading skeleton. Authors need the canvas visible at all times,
  // even while the workspace schema loader is in flight or returns
  // null (broken / missing URN). Quick Runner (mode === 'simulation')
  // keeps the skeleton because it's a meaningful "waiting on engine"
  // signal there.
  const showLoadingSkeleton =
    mode !== 'preview' && (loading || schemaResolving || schemaNotReady);
  if (showLoadingSkeleton) {
    return (
      <div role="region" aria-label={ariaLabel} className={hostClassName} data-pseudo-ui-root="">
        <LoadingSkeleton />
      </div>
    );
  }

  if (payloadEmpty) {
    return (
      <div role="region" aria-label={ariaLabel} className={hostClassName} data-pseudo-ui-root="">
        <p className="text-[12px] text-[var(--vscode-foreground)]">This view has nothing to display.</p>
        <p className="mt-1 text-[11px] text-[var(--vscode-descriptionForeground)]">
          Add fields, buttons, or child layout nodes to the view definition JSON.
        </p>
      </div>
    );
  }

  if (invalidDefinition || viewDefinition === null) {
    return (
      <div role="region" aria-label={ariaLabel} className={hostClassName} data-pseudo-ui-root="">
        <div
          role="alert"
          className="mb-2 rounded border border-[var(--vscode-inputValidation-warningBorder)] bg-[var(--vscode-inputValidation-warningBackground)] px-2 py-2 text-[11px] text-[var(--vscode-foreground)]"
        >
          <p className="mb-2">This view definition could not be parsed for preview.</p>
          <button
            type="button"
            className="rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-button-secondaryBackground)] px-2 py-1 text-[10px] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-list-hoverBackground)] focus-visible:outline focus-visible:outline-[var(--vscode-focusBorder)]"
            onClick={() => setDefinitionRetry((n) => n + 1)}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const scrollWrapClass = fillHeight ? 'pseudo-ui-host__scroll relative min-h-0 flex-1' : 'relative';

  const mount = (
    <PseudoUiErrorBoundary
      resetKey={boundaryReset}
      actions={errorActions}
      onError={(err, info) => {
        surfaceLogger.error('[pseudo-ui] Render crashed — falling back to JSON view', {
          timestamp: new Date().toISOString(),
          message: err.message,
          nodeType: info.nodeType,
          componentStack: info.componentStack,
        });
        onError?.(err.message);
      }}
      renderFallback={(err, info) => (
        <div className="flex flex-col gap-2">
          <div
            role="alert"
            className="rounded border border-[var(--vscode-inputValidation-errorBorder)] bg-[var(--vscode-inputValidation-errorBackground)] px-2 py-2 text-[11px] text-[var(--vscode-errorForeground)]"
          >
            <p className="mb-1 font-medium">
              {info.nodeType
                ? `The "${info.nodeType}" component could not be rendered`
                : 'This view could not be rendered as pseudo-ui'}
            </p>
            <p className="text-[var(--vscode-foreground)]">
              {err.message || 'An unexpected error occurred while rendering the view.'}
            </p>
            <p className="mt-1 text-[10px] text-[var(--vscode-descriptionForeground)]">
              Showing the raw view JSON instead so you can keep working. Click Retry
              after editing the view definition.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-button-secondaryBackground)] px-2 py-1 text-[10px] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-list-hoverBackground)] focus-visible:outline focus-visible:outline-[var(--vscode-focusBorder)]"
                onClick={info.reset}
              >
                Retry
              </button>
              {errorActions?.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  className="rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-button-secondaryBackground)] px-2 py-1 text-[10px] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-list-hoverBackground)] focus-visible:outline focus-visible:outline-[var(--vscode-focusBorder)]"
                  onClick={action.onTrigger}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
          <CopyableJsonBlock value={viewResponse.content} fillHeight={fillHeight} />
        </div>
      )}
    >
      <PseudoUiPseudoViewFrame
        schema={schema}
        view={viewDefinition}
        formData={formData}
        instanceData={instanceData}
        lang={lang}
        delegate={wrappedDelegate}
        onFormChange={(next) => setFormData(next)}
        designer={effectiveDesigner}
        selectedNodePath={selectedNodePath}
        designerClassNames={designerClassNames}
        fillHeight={fillHeight}
      />
    </PseudoUiErrorBoundary>
  );

  // R26.S2 — surface a missing-schema warning so the user sees WHY
  // enum / dropdown / radio inputs render with zero options. The
  // SDK still mounts with `{}` (degraded mode) so the view is at
  // least visible and editable.
  const schemaMissingWarning =
    schemaResolutionAttempted && expectingAsyncSchema && resolvedSchema === null;

  return (
    <div role="region" aria-label={ariaLabel} className={hostClassName} data-pseudo-ui-root="">
      {schemaMissingWarning ? (
        <div
          role="status"
          className="mb-2 rounded border border-[var(--vscode-inputValidation-warningBorder)] bg-[var(--vscode-inputValidation-warningBackground)] px-2 py-1 text-[11px] text-[var(--vscode-foreground)]"
        >
          Could not resolve schema for{' '}
          <code className="text-[10px]">{normalized?.dataSchema ?? '(no URN)'}</code>.
          Enum / dropdown inputs may render empty.
        </div>
      ) : null}
      {successFlash ? (
        <div
          aria-live="polite"
          className="mb-2 rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-inactiveSelectionBackground)] px-2 py-1 text-[11px] text-[var(--vscode-foreground)] motion-reduce:transition-none motion-safe:transition-opacity motion-safe:duration-150"
        >
          Transition submitted
        </div>
      ) : null}
      {actionError ? (
        <div
          role="alert"
          className="mb-2 rounded border border-[var(--vscode-inputValidation-errorBorder)] bg-[var(--vscode-inputValidation-errorBackground)] px-2 py-2 text-[11px] text-[var(--vscode-errorForeground)]"
        >
          <p className="mb-2 font-medium">{actionError}</p>
          {/* R24.5 — engine validation errors. `path` is the dotted
              JSON pointer of the offending field (`customer.ownerUserId`),
              `label` is the human label from the schema. */}
          {actionFieldErrors && actionFieldErrors.length > 0 ? (
            <ul className="mb-2 space-y-0.5 pl-0">
              {actionFieldErrors.map((fe, idx) => (
                <li key={`${fe.path}-${idx}`} className="flex flex-col">
                  <span>
                    <span className="font-mono text-[10px] text-[var(--vscode-descriptionForeground)]">
                      {fe.label ? `${fe.label} (${fe.path})` : fe.path}
                    </span>
                    {': '}
                    <span>{fe.message}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            className="rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-button-secondaryBackground)] px-2 py-1 text-[10px] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-list-hoverBackground)] focus-visible:outline focus-visible:outline-[var(--vscode-focusBorder)]"
            onClick={() => {
              setActionError(null);
              setActionFieldErrors(null);
            }}
          >
            Dismiss
          </button>
        </div>
      ) : null}
      <div className={scrollWrapClass}>
        {actionPending ? (
          <div
            className="absolute inset-0 z-[1] flex items-center justify-center gap-2 rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-editor-background)] opacity-95"
            aria-busy="true"
            aria-label="Submitting"
          >
            <span className="text-[11px] font-medium text-[var(--vscode-foreground)]">Submitting...</span>
          </div>
        ) : null}
        {mount}
      </div>
    </div>
  );
}
