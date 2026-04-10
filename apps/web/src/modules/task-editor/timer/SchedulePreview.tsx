import { describeCron } from './CronUtils';

interface SchedulePreviewProps {
  expression: string;
}

export function SchedulePreview({ expression }: SchedulePreviewProps) {
  const description = describeCron(expression);

  return (
    <div className="rounded-lg border border-muted-border bg-muted-surface p-2">
      <div className="text-[10px] text-muted-foreground mb-1">Schedule Description</div>
      <div className="text-xs">{description}</div>
    </div>
  );
}
