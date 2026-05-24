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
import type { DataSchema, PseudoViewDelegate, ViewDefinition } from '@burgantech/pseudo-ui';
import type { DesignerClassNames, DesignerMode } from '@burgantech/pseudo-ui/react';

import type { ViewResponse } from '../types/quickrun.types';
import type { SchemaResolver } from './createDataSchemaResolver';
import { normalizePseudoUiPayload } from './normalizePseudoUiPayload';
import { PseudoUiErrorBoundary, type PseudoUiErrorAction } from './PseudoUiErrorBoundary';
import { PseudoUiPseudoViewFrame } from './PseudoUiPseudoViewFrame';

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
  lang = 'en',
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

  const [definitionRetry, setDefinitionRetry] = useState(0);
  const [boundaryReset, setBoundaryReset] = useState(0);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successFlash, setSuccessFlash] = useState(false);
  const [resolvedSchema, setResolvedSchema] = useState<DataSchema | null>(null);
  const [schemaResolving, setSchemaResolving] = useState(false);
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
          const msg = e instanceof Error ? e.message : 'Action failed';
          setActionError(msg);
          onError?.(msg);
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
      return;
    }
    // Skip if no dataSchema reference or no resolver
    if (!normalized?.dataSchema || !resolveSchema) {
      setSchemaResolving(false);
      return;
    }

    let cancelled = false;
    setSchemaResolving(true);
    void resolveSchema(normalized.dataSchema)
      .then((result) => {
        if (!cancelled) setResolvedSchema(result);
      })
      .catch(() => {
        if (!cancelled) setResolvedSchema(null);
      })
      .finally(() => {
        if (!cancelled) setSchemaResolving(false);
      });

    return () => {
      cancelled = true;
    };
  }, [normalized?.dataSchema, resolveSchema, schemaProp]);

  const schema: DataSchema =
    schemaProp && Object.keys(schemaProp).length > 0
      ? schemaProp
      : (resolvedSchema ?? ({} as DataSchema));

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

  if (loading || schemaResolving) {
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
      onError={(err) => onError?.(err.message)}
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

  return (
    <div role="region" aria-label={ariaLabel} className={hostClassName} data-pseudo-ui-root="">
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
          <p className="mb-2">{actionError}</p>
          <button
            type="button"
            className="rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-button-secondaryBackground)] px-2 py-1 text-[10px] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-list-hoverBackground)] focus-visible:outline focus-visible:outline-[var(--vscode-focusBorder)]"
            onClick={() => setActionError(null)}
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
