import { useId } from 'react';

interface ComponentDescriptionFieldProps {
  value: string;
  onChange: (value: string) => void;
}

const textareaClass =
  'border-border bg-muted-surface text-foreground focus:ring-ring/20 focus:border-primary-border focus:bg-surface placeholder:text-subtle w-full resize-y rounded-xl border px-2.5 py-2 font-mono text-xs transition-all focus:ring-2 focus:outline-none';

export function ComponentDescriptionField({
  value,
  onChange,
}: ComponentDescriptionFieldProps) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="text-muted-foreground block text-[10px] font-semibold tracking-wide">
        Description
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Component description..."
        rows={2}
        className={textareaClass}
      />
    </div>
  );
}
