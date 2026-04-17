import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';

interface DurationPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function DurationPicker({ value, onChange }: DurationPickerProps) {
  const parsed = parseDuration(value);

  function update(field: string, val: number) {
    const next = { ...parsed, [field]: val };
    onChange(formatDuration(next));
  }

  return (
    <div className="grid grid-cols-4 gap-2">
      <Field label="Days">
        <Input
          type="number"
          value={parsed.days}
          onChange={(e) => update('days', Number(e.target.value))}
          min={0}
          size="sm"
          inputClassName="text-center text-xs"
        />
      </Field>
      <Field label="Hours">
        <Input
          type="number"
          value={parsed.hours}
          onChange={(e) => update('hours', Number(e.target.value))}
          min={0}
          max={23}
          size="sm"
          inputClassName="text-center text-xs"
        />
      </Field>
      <Field label="Minutes">
        <Input
          type="number"
          value={parsed.minutes}
          onChange={(e) => update('minutes', Number(e.target.value))}
          min={0}
          max={59}
          size="sm"
          inputClassName="text-center text-xs"
        />
      </Field>
      <Field label="Seconds">
        <Input
          type="number"
          value={parsed.seconds}
          onChange={(e) => update('seconds', Number(e.target.value))}
          min={0}
          max={59}
          size="sm"
          inputClassName="text-center text-xs"
        />
      </Field>
    </div>
  );
}

interface Duration {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function parseDuration(iso: string): Duration {
  const result: Duration = { days: 0, hours: 0, minutes: 0, seconds: 0 };
  if (!iso.startsWith('P')) return result;

  const timeMatch = iso.match(/T(.+)/);
  const dateMatch = iso.match(/P([^T]*)/);

  if (dateMatch?.[1]) {
    const d = dateMatch[1].match(/(\d+)D/);
    if (d) result.days = Number(d[1]);
  }

  if (timeMatch?.[1]) {
    const h = timeMatch[1].match(/(\d+)H/);
    const m = timeMatch[1].match(/(\d+)M/);
    const s = timeMatch[1].match(/(\d+)S/);
    if (h) result.hours = Number(h[1]);
    if (m) result.minutes = Number(m[1]);
    if (s) result.seconds = Number(s[1]);
  }

  return result;
}

function formatDuration(d: Duration): string {
  let result = 'P';
  if (d.days > 0) result += `${d.days}D`;
  const hasTime = d.hours > 0 || d.minutes > 0 || d.seconds > 0;
  if (hasTime) {
    result += 'T';
    if (d.hours > 0) result += `${d.hours}H`;
    if (d.minutes > 0) result += `${d.minutes}M`;
    if (d.seconds > 0) result += `${d.seconds}S`;
  }
  if (result === 'P') result = 'PT0S';
  return result;
}

