import { Field } from '@shared/ui/Field';
import { TagEditor } from '@shared/ui/TagEditor';
import { Badge } from '@shared/ui/Badge';
import { cn } from '@shared/lib/utils/Cn';
import { RetryPolicyEditor } from './RetryPolicyEditor';

interface ErrorHandlerFormProps {
  handler: any;
  onChange: (updater: (draft: any) => void) => void;
}

const ERROR_ACTIONS = [
  { value: 0, label: 'Abort', variant: 'destructive' as const },
  { value: 1, label: 'Retry', variant: 'success' as const },
  { value: 2, label: 'Rollback', variant: 'destructive' as const },
  { value: 3, label: 'Ignore', variant: 'muted' as const },
  { value: 4, label: 'Notify', variant: 'tertiary' as const },
  { value: 5, label: 'Log', variant: 'secondary' as const },
];

export function ErrorHandlerForm({ handler, onChange }: ErrorHandlerFormProps) {
  const showRetry = handler.action === 1;

  return (
    <div className="space-y-2">
      <Field label="Action">
        <div className="flex flex-wrap gap-1">
          {ERROR_ACTIONS.map((action) => (
            <button
              key={action.value}
              type="button"
              onClick={() => onChange((d) => { d.action = action.value; })}
              className="rounded-md transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            >
              <Badge
                variant={handler.action === action.value ? action.variant : 'muted'}
                interactive
                hoverable
                className={cn(
                  'px-2 py-1 text-[10px] font-semibold',
                  handler.action === action.value &&
                    action.variant === 'muted' &&
                    'border-foreground/20 bg-muted text-foreground ring-1 ring-foreground/10',
                  handler.action !== action.value && 'border-muted-border bg-muted-surface text-muted-text',
                )}
              >
                {action.label}
              </Badge>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Error Types">
        <TagEditor
          tags={handler.errorTypes || []}
          onChange={(tags) => onChange((d) => { d.errorTypes = tags; })}
          placeholder="Add error type..."
        />
      </Field>

      <Field label="Error Codes">
        <TagEditor
          tags={(handler.errorCodes || []).map(String)}
          onChange={(tags) => onChange((d) => { d.errorCodes = tags; })}
          placeholder="Add error code..."
        />
      </Field>

      {showRetry && (
        <RetryPolicyEditor
          policy={handler.retryPolicy || {}}
          onChange={(updater) => {
            onChange((d) => {
              if (!d.retryPolicy) d.retryPolicy = {};
              updater(d.retryPolicy);
            });
          }}
        />
      )}
    </div>
  );
}

