import { useState } from 'react';
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
        <button
          onClick={() => setMode('cron')}
          className={`px-2 py-0.5 text-[10px] rounded ${mode === 'cron' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
        >
          Cron
        </button>
        <button
          onClick={() => setMode('duration')}
          className={`px-2 py-0.5 text-[10px] rounded ${mode === 'duration' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
        >
          Duration
        </button>
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
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono mt-1"
        />
      </div>
    </div>
  );
}
