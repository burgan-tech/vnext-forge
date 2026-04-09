import { Plus, Trash2 } from 'lucide-react';
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
        <div className="text-xs font-medium">Error Handlers ({handlers.length})</div>
        <button
          onClick={addHandler}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
        >
          <Plus size={10} /> Add Handler
        </button>
      </div>

      {handlers.length === 0 ? (
        <div className="text-[10px] text-muted-foreground">No error handlers configured</div>
      ) : (
        <div className="space-y-2">
          {handlers.map((handler: any, i: number) => (
            <div key={i} className="border border-border rounded p-2 relative group">
              <button
                onClick={() => removeHandler(i)}
                className="absolute top-2 right-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={12} />
              </button>
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
