import { Component, type ErrorInfo, type ReactNode } from 'react';

/** Optional caller-supplied action surface — View Editor wires "Edit JSON";
 * Quick Runner can pass nothing and the buttons stay hidden. */
export interface PseudoUiErrorAction {
  label: string;
  onTrigger: () => void;
}

export interface PseudoUiErrorBoundaryProps {
  /** Bumping this number from outside clears the error and re-renders children. */
  resetKey: number;
  children: ReactNode;
  /** Extra action buttons (e.g. "Edit as JSON" from View Editor). */
  actions?: PseudoUiErrorAction[];
  /** Called whenever an error is captured — host can log to its own channel. */
  onError?: (error: Error, info: { componentStack: string; nodeType: string | null }) => void;
}

interface State {
  error: Error | null;
  componentStack: string;
  nodeType: string | null;
  copied: boolean;
}

/**
 * Pseudo-ui specific error boundary.
 *
 * Why this exists separate from a generic boundary: when a pseudo-ui view
 * crashes mid-render, the user wants to know *which node* blew up and how to
 * recover. We parse React's componentStack to surface the failing pseudo-ui
 * component type (`DynamicRenderer<TextField>` → "TextField") and give the
 * host a hook to wire its own escape hatches.
 */
export class PseudoUiErrorBoundary extends Component<PseudoUiErrorBoundaryProps, State> {
  state: State = { error: null, componentStack: '', nodeType: null, copied: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const componentStack = errorInfo.componentStack ?? '';
    const nodeType = parsePseudoNodeType(componentStack);
    this.setState({ componentStack, nodeType });
    this.props.onError?.(error, { componentStack, nodeType });
  }

  componentDidUpdate(prevProps: PseudoUiErrorBoundaryProps): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, componentStack: '', nodeType: null, copied: false });
    }
  }

  private handleCopy = async (): Promise<void> => {
    const { error, componentStack, nodeType } = this.state;
    if (!error) return;
    const payload = [
      nodeType ? `Failed node: ${nodeType}` : 'Failed node: <unknown>',
      `Message: ${error.message}`,
      error.stack ? `Stack:\n${error.stack}` : '',
      componentStack ? `Component stack:${componentStack}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    try {
      await navigator.clipboard.writeText(payload);
      this.setState({ copied: true });
      window.setTimeout(() => {
        this.setState((s) => (s.copied ? { ...s, copied: false } : s));
      }, 1800);
    } catch {
      // Clipboard not available (sandboxed webview without permission).
      // Fall back to selecting the text inside <details>.
    }
  };

  render(): ReactNode {
    const { error, componentStack, nodeType, copied } = this.state;
    if (!error) return this.props.children;

    const title = nodeType
      ? `The "${nodeType}" component could not be rendered`
      : 'This view could not be rendered';

    return (
      <div
        role="alert"
        className="rounded border border-[var(--vscode-inputValidation-errorBorder)] bg-[var(--vscode-inputValidation-errorBackground)] px-3 py-3 text-[12px] text-[var(--vscode-errorForeground)]"
      >
        <p className="mb-1 font-semibold">{title}</p>
        <p className="mb-2 text-[var(--vscode-foreground)]">
          {error.message || 'An unexpected error occurred while rendering the view.'}
        </p>

        <details className="mb-2 text-[11px] text-[var(--vscode-descriptionForeground)]">
          <summary className="cursor-pointer select-none">Technical details</summary>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-[var(--vscode-editor-inactiveSelectionBackground)] p-2 text-[10px]">
            {error.stack ?? error.message}
            {componentStack ? `\n\nComponent stack:${componentStack}` : ''}
          </pre>
        </details>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-button-secondaryBackground)] px-2 py-1 text-[11px] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-list-hoverBackground)] focus-visible:outline focus-visible:outline-[var(--vscode-focusBorder)]"
            onClick={() => {
              this.setState({ error: null, componentStack: '', nodeType: null, copied: false });
            }}
          >
            Retry
          </button>
          <button
            type="button"
            className="rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-button-secondaryBackground)] px-2 py-1 text-[11px] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-list-hoverBackground)] focus-visible:outline focus-visible:outline-[var(--vscode-focusBorder)]"
            onClick={() => {
              void this.handleCopy();
            }}
          >
            {copied ? 'Copied' : 'Copy error'}
          </button>
          {this.props.actions?.map((action) => (
            <button
              key={action.label}
              type="button"
              className="rounded border border-[var(--vscode-panel-border)] bg-[var(--vscode-button-secondaryBackground)] px-2 py-1 text-[11px] text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-list-hoverBackground)] focus-visible:outline focus-visible:outline-[var(--vscode-focusBorder)]"
              onClick={action.onTrigger}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    );
  }
}

/**
 * Walk the React component stack from the leaf up and return the first
 * pseudo-ui component type we can identify.
 *
 * Component stack format (one frame per line):
 *   "    in DynamicRenderer (created by SomeParent)"
 *   "    in PseudoView"
 *
 * pseudo-ui registers each component via the DynamicRenderer dispatcher,
 * so the most useful signal is the closest `DynamicRenderer` frame plus the
 * `data-pseudo-type` attribute the SDK emits on the rendered element. We
 * can't read DOM attributes here, but stack frames also include the rendered
 * component name (e.g. "Card", "TextField") for React-defined adapters.
 */
function parsePseudoNodeType(componentStack: string): string | null {
  if (!componentStack) return null;
  const lines = componentStack.split('\n').map((l) => l.trim()).filter(Boolean);

  // Known pseudo-ui component type tokens (matches componentCatalog types).
  // Keep this conservative: false positives are worse than null.
  const PSEUDO_TYPES = new Set([
    'Column', 'Row', 'Expanded', 'Wrap', 'Stack', 'Grid', 'Spacer', 'Center', 'ScrollView',
    'Card', 'ExpansionPanel', 'Stepper', 'TabView', 'Divider',
    'TextField', 'TextArea', 'NumberField', 'Dropdown', 'Checkbox', 'RadioGroup', 'Switch',
    'DatePicker', 'TimePicker', 'Slider', 'SegmentedButton', 'SearchField', 'AutoComplete',
    'Text', 'Icon', 'Image', 'Chip', 'Badge', 'ProgressIndicator', 'LoadingIndicator',
    'ListTile', 'Avatar', 'RichText',
    'Button', 'IconButton', 'FAB',
    'Dialog', 'BottomSheet', 'SideSheet', 'Snackbar', 'Tooltip',
    'AppBar', 'NavigationBar', 'NavigationDrawer', 'Menu', 'Toolbar',
    'Carousel', 'ForEach', 'Component',
  ]);

  for (const line of lines) {
    // "in X" or "in X (created by Y)"
    const match = /^in\s+([A-Z][A-Za-z0-9]*)/.exec(line);
    if (!match) continue;
    const candidate = match[1];
    if (PSEUDO_TYPES.has(candidate)) return candidate;
  }
  return null;
}
