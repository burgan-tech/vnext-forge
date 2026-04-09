import { Field } from '../components/Field';
import { TagEditor } from '../components/TagEditor';
import { RetryPolicyEditor } from './RetryPolicyEditor';

interface ErrorHandlerFormProps {
  handler: any;
  onChange: (updater: (draft: any) => void) => void;
}

const ERROR_ACTIONS = [
  { value: 0, label: 'Abort' },
  { value: 1, label: 'Retry' },
  { value: 2, label: 'Rollback' },
  { value: 3, label: 'Ignore' },
  { value: 4, label: 'Notify' },
  { value: 5, label: 'Log' },
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
              onClick={() => onChange((d) => { d.action = action.value; })}
              className={`px-2 py-0.5 text-[10px] rounded border ${
                handler.action === action.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:bg-muted text-muted-foreground'
              }`}
            >
              {action.label}
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
