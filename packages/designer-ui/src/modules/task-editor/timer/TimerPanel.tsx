import { useState } from 'react';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { CronExpressionBuilder } from './CronExpressionBuilder';
import { DurationPicker } from './DurationPicker';
import { SchedulePreview } from './SchedulePreview';

interface TimerPanelProps {
  value: string;
  onChange: (value: string) => void;
}

export function TimerPanel({ value, onChange }: TimerPanelProps) {
  const [mode, setMode] = useState<'cron' | 'duration'>(() => {
    // Detect mode from value: ISO 8601 durations start with P
    if (value.startsWith('P')) return 'duration';
    return 'cron';
  });

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant={mode === 'cron' ? 'default' : 'muted'}
          onClick={() => setMode('cron')}
          className="h-6 px-2 text-[10px]"
        >
          Cron
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === 'duration' ? 'default' : 'muted'}
          onClick={() => setMode('duration')}
          className="h-6 px-2 text-[10px]"
        >
          Duration
        </Button>
      </div>

      {mode === 'cron' ? (
        <>
          <CronExpressionBuilder value={value} onChange={onChange} />
          <SchedulePreview expression={value} />
        </>
      ) : (
        <DurationPicker value={value} onChange={onChange} />
      )}

      <div className="border-t border-border pt-2">
        <div className="text-[10px] text-muted-foreground">Raw value</div>
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          size="sm"
          className="mt-1"
          inputClassName="font-mono text-xs"
        />
      </div>
    </div>
  );
}
