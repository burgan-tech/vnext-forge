import { Field } from '../../../ui/Field';
import { RadioCard, RadioCardGroup } from '../../../ui/RadioCard';

const TASK_TYPES = [
  { value: '3', label: 'Dapr Service Invocation', desc: 'Invoke a Dapr service' },
  { value: '4', label: 'Dapr PubSub', desc: 'Publish / subscribe' },
  { value: '5', label: 'Script (C#)', desc: 'C# script task' },
  { value: '6', label: 'HTTP Request', desc: 'Outbound HTTP call' },
  { value: '7', label: 'Dapr Binding', desc: 'Binding invocation' },
  { value: '11', label: 'Start Workflow', desc: 'Start another workflow' },
  { value: '12', label: 'Direct Trigger', desc: 'Direct transition trigger' },
  { value: '13', label: 'Get Instance Data', desc: 'Read instance payload' },
  { value: '14', label: 'SubProcess / Start Trigger', desc: 'Subprocess or start trigger' },
  { value: '15', label: 'Get Instances', desc: 'Query instances' },
] as const;

interface TaskTypePickerProps {
  value: string;
  onChange: (taskType: string) => void;
}

export function TaskTypePicker({ value, onChange }: TaskTypePickerProps) {
  return (
    <Field
      label="Task Type"
      className="flex h-full min-h-0 flex-col gap-1.5 space-y-0">
      <RadioCardGroup
        value={value}
        onValueChange={(v: string | number) => onChange(String(v))}
        aria-label="Task type"
        className="grid max-h-[min(28rem,55vh)] min-h-0 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
        {TASK_TYPES.map((t) => (
          <RadioCard
            key={t.value}
            value={t.value}
            label={t.label}
            description={t.desc}
            className="my-px h-auto min-h-0 w-full shrink-0 [&>span]:px-2.5 [&>span]:py-1.5"
          />
        ))}
      </RadioCardGroup>
    </Field>
  );
}
