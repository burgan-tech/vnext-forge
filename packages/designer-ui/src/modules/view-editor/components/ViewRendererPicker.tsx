import { ViewRenderer } from '@vnext-forge-studio/vnext-types';

const RENDERER_OPTIONS = [
  { value: '', label: '(none)' },
  { value: ViewRenderer.PseudoUi, label: 'Pseudo UI' },
  { value: ViewRenderer.Flutter, label: 'Flutter' },
  { value: ViewRenderer.Angular, label: 'Angular' },
  { value: ViewRenderer.Vue, label: 'Vue' },
  { value: ViewRenderer.React, label: 'React' },
  { value: ViewRenderer.ReactNative, label: 'React Native' },
  { value: ViewRenderer.NativeIos, label: 'Native iOS' },
  { value: ViewRenderer.NativeAndroid, label: 'Native Android' },
] as const;

interface ViewRendererPickerProps {
  value: string;
  onChange: (renderer: string) => void;
}

export function ViewRendererPicker({ value, onChange }: ViewRendererPickerProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 text-xs border border-border rounded-xl bg-muted-surface text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary-border focus:bg-surface transition-all cursor-pointer"
      aria-label="View renderer">
      {RENDERER_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}
