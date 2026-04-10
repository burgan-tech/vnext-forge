import { Field } from '@shared/ui/Field';
import { parseCron, formatCron } from './CronUtils';

interface CronExpressionBuilderProps {
  value: string;
  onChange: (value: string) => void;
}

export function CronExpressionBuilder({ value, onChange }: CronExpressionBuilderProps) {
  const parts = parseCron(value);

  function updatePart(index: number, val: string) {
    const next = [...parts];
    next[index] = val;
    onChange(formatCron(next));
  }

  const labels = ['Minute', 'Hour', 'Day', 'Month', 'Weekday'];
  const placeholders = ['0-59', '0-23', '1-31', '1-12', '0-6 (Sun=0)'];

  return (
    <div className="grid grid-cols-5 gap-1">
      {labels.map((label, i) => (
        <Field key={label} label={label}>
          <input
            type="text"
            value={parts[i] || '*'}
            onChange={(e) => updatePart(i, e.target.value)}
            placeholder={placeholders[i]}
            className="w-full px-1.5 py-1 text-xs border border-border rounded bg-background font-mono text-center"
          />
        </Field>
      ))}
    </div>
  );
}

