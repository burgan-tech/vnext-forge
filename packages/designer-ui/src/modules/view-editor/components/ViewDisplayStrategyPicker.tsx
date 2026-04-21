import { RadioCard, RadioCardGroup } from '../../../ui/RadioCard';

const DISPLAY_STRATEGIES = [
  { value: 'full-page', label: 'Full Page', desc: 'Takes full screen' },
  { value: 'popup', label: 'Popup', desc: 'Modal dialog' },
  { value: 'drawer', label: 'Drawer', desc: 'Side panel' },
  { value: 'bottom-sheet', label: 'Bottom Sheet', desc: 'Slides up' },
  { value: 'top-sheet', label: 'Top Sheet', desc: 'Slides down' },
  { value: 'inline', label: 'Inline', desc: 'Embedded in page' },
] as const;

interface ViewDisplayStrategyPickerProps {
  value: string;
  onChange: (strategy: string) => void;
}

/** Kart başlığı dışarıda olduğu için burada yalnızca RadioCardGroup (Extension Type ile aynı kalıp). */
export function ViewDisplayStrategyPicker({ value, onChange }: ViewDisplayStrategyPickerProps) {
  return (
    <RadioCardGroup
      value={value}
      onValueChange={(v: string | number) => onChange(String(v))}
      aria-label="Display strategy"
      className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {DISPLAY_STRATEGIES.map((s) => (
        <RadioCard key={s.value} value={s.value} label={s.label} description={s.desc} />
      ))}
    </RadioCardGroup>
  );
}
