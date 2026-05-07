import { Component, type ErrorInfo, type ReactNode } from 'react';

import { createLogger } from '@vnext-forge-studio/designer-ui';

const logger = createLogger('web/RouteErrorBoundary');

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  supportRef: string | null;
}

export class RouteErrorBoundary extends Component<Props, State> {
  public state: State = { error: null, supportRef: null };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      error,
      supportRef:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : null,
    };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('Route subtree render failed', { error, componentStack: info.componentStack });
  }

  private handleRetry = (): void => {
    this.setState({ error: null, supportRef: null });
  };

  public render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="text-foreground flex h-full min-h-[12rem] flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-destructive text-sm font-medium">Something went wrong in this view.</p>
          <p className="text-muted-foreground max-w-md text-xs leading-relaxed">
            {this.state.error.message}
          </p>
          {this.state.supportRef ? (
            <p className="text-muted-foreground font-mono text-[11px]">
              Reference: {this.state.supportRef}
            </p>
          ) : null}
          <button
            type="button"
            onClick={this.handleRetry}
            className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium">
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
