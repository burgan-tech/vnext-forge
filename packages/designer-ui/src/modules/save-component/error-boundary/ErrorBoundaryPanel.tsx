import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../ui/Button';
import { Badge } from '../../../ui/Badge';
import { Alert, AlertDescription, AlertTitle } from '../../../ui/Alert';
import { ErrorHandlerForm } from './ErrorHandlerForm';

interface ErrorBoundaryPanelProps {
  errorBoundary: any;
  onChange: (updater: (draft: any) => void) => void;
}

export function ErrorBoundaryPanel({ errorBoundary, onChange }: ErrorBoundaryPanelProps) {
  const handlers = errorBoundary?.handlers || [];

  function addHandler() {
    onChange((draft) => {
      if (!draft.handlers) draft.handlers = [];
      draft.handlers.push({
        action: 0,
        errorTypes: [],
        errorCodes: [],
      });
    });
  }

  function removeHandler(index: number) {
    onChange((draft) => {
      if (draft.handlers) {
        draft.handlers.splice(index, 1);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-xs font-medium text-foreground">Error Handlers</div>
          <Badge variant={handlers.length > 0 ? 'destructive' : 'muted'}>{handlers.length}</Badge>
        </div>
        <Button
          type="button"
          onClick={addHandler}
          variant="default"
          size="sm"
          leftIconComponent={
            <span className="bg-success-surface text-success-icon group-hover/button:bg-success-hover flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors duration-200">
              <Plus size={12} />
            </span>
          }>
          Add Handler
        </Button>
      </div>

      {handlers.length === 0 ? (
        <Alert variant="muted" className="py-2">
          <AlertCircle />
          <AlertTitle>No error handlers configured</AlertTitle>
          <AlertDescription>
            Add a handler when this component needs a visible failure strategy.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-2">
          {handlers.map((handler: any, i: number) => (
            <div
              key={i}
              className="rounded-lg border border-destructive-border bg-destructive-surface/35 p-3"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <Badge variant="destructive">Handler #{i + 1}</Badge>
                <Button
                  type="button"
                  onClick={() => removeHandler(i)}
                  variant="default"
                  size="sm"
                  leftIconComponent={
                    <span className="bg-destructive-surface text-destructive-icon group-hover/button:bg-destructive-hover flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors duration-200">
                      <Trash2 size={12} />
                    </span>
                  }>
                  Remove Handler
                </Button>
              </div>
              <ErrorHandlerForm
                handler={handler}
                onChange={(updater) => {
                  onChange((draft) => {
                    if (draft.handlers?.[i]) {
                      updater(draft.handlers[i]);
                    }
                  });
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
