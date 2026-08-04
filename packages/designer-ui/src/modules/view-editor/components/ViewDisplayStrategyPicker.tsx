import type { ViewDisplayOption } from '@vnext-forge-studio/vnext-types';

import { RadioCard, RadioCardGroup } from '../../../ui/RadioCard';

/**
 * Sentinel for "no value declared".
 *
 * `RadioCardGroup` compares by value and has no concept of an empty selection,
 * so an unset mode needs a value of its own. It never reaches the component
 * JSON: `onChange` maps it back to `undefined`, and the caller drops the key.
 */
const UNSET_VALUE = '__unset__';

interface ViewDisplayStrategyPickerProps<TValue extends string> {
  /** The currently declared value, or `undefined` when the mode is not set. */
  value: TValue | undefined;
  options: readonly ViewDisplayOption<TValue>[];
  onChange: (next: TValue | undefined) => void;
  /**
   * Renders a leading "Not set" card. Off by default so a required
   * single-choice picker cannot accidentally offer an empty state.
   */
  allowUnset?: boolean;
  ariaLabel: string;
}

/**
 * Options-driven radio-card picker for one display mode.
 *
 * Generic over the mode's value union rather than hardcoding a list, so SDI and
 * MDI share one component and one layout. The option lists live in
 * `@vnext-forge-studio/vnext-types` alongside the type unions — before that, six
 * SDI values were duplicated here as a local `as const` with no compile-time
 * link to the union, so adding a mode meant editing unconnected files.
 *
 * Card title is rendered outside; only RadioCardGroup here (same pattern as
 * Extension Type).
 */
export function ViewDisplayStrategyPicker<TValue extends string>({
  value,
  options,
  onChange,
  allowUnset = false,
  ariaLabel,
}: ViewDisplayStrategyPickerProps<TValue>) {
  return (
    <RadioCardGroup
      value={value ?? UNSET_VALUE}
      onValueChange={(next: string | number) => {
        const raw = String(next);
        onChange(raw === UNSET_VALUE ? undefined : (raw as TValue));
      }}
      aria-label={ariaLabel}
      className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {allowUnset ? (
        <RadioCard value={UNSET_VALUE} label="Not set" description="Leave undeclared" />
      ) : null}
      {options.map((option) => (
        <RadioCard
          key={option.value}
          value={option.value}
          label={option.label}
          description={option.description}
        />
      ))}
    </RadioCardGroup>
  );
}
