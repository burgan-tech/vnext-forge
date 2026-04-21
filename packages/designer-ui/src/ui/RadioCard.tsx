import * as React from 'react';

import { cn } from '../lib/utils/cn.js';
import { Button } from './Button.js';

export type RadioCardValue = string | number;

type RadioCardGroupContextValue = {
  value: RadioCardValue;
  onValueChange: (next: RadioCardValue) => void;
};

const RadioCardGroupContext = React.createContext<RadioCardGroupContextValue | null>(null);

function useRadioCardGroupContext(component: string): RadioCardGroupContextValue {
  const ctx = React.useContext(RadioCardGroupContext);
  if (!ctx) {
    throw new Error(`${component} must be used within RadioCardGroup`);
  }
  return ctx;
}

/**
 * Shared Button chrome for card-style radio items (full-width / grid cells).
 * Pass via RadioCard `className` when options need `flex-1`, `min-h-0`, etc.
 */
export const radioCardButtonClassName = cn(
  'h-full min-h-0 w-full rounded-lg shadow-none',
  '[&>span]:h-full [&>span]:min-h-0 [&>span]:w-full [&>span]:items-center [&>span]:justify-start [&>span]:gap-0 [&>span]:px-3 [&>span]:py-2.5',
);

export type RadioCardGroupProps = Omit<React.ComponentProps<'div'>, 'role' | 'onChange'> & {
  value: RadioCardValue;
  onValueChange: (next: RadioCardValue) => void;
};

function RadioCardGroup({
  value,
  onValueChange,
  className,
  children,
  ...props
}: RadioCardGroupProps) {
  const store = React.useMemo(() => ({ value, onValueChange }), [value, onValueChange]);

  return (
    <RadioCardGroupContext.Provider value={store}>
      <div role="radiogroup" className={cn(className)} {...props}>
        {children}
      </div>
    </RadioCardGroupContext.Provider>
  );
}

export type RadioCardProps = Omit<
  React.ComponentProps<typeof Button>,
  'type' | 'role' | 'variant' | 'size' | 'children'
> & {
  value: RadioCardValue;
  label: React.ReactNode;
  description?: React.ReactNode;
};

function RadioCard({
  value,
  label,
  description,
  className,
  disabled,
  onClick,
  ...props
}: RadioCardProps) {
  const { value: groupValue, onValueChange } = useRadioCardGroupContext('RadioCard');
  const selected = groupValue === value;

  return (
    <Button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      size="default"
      variant={selected ? 'success' : 'secondary'}
      className={cn(radioCardButtonClassName, className)}
      onClick={(e) => {
        onClick?.(e);
        if (!disabled && !e.defaultPrevented) {
          onValueChange(value);
        }
      }}
      {...props}>
      <span className="flex w-full min-w-0 flex-row items-center gap-3 text-left">
        <span
          aria-hidden
          className={cn(
            'size-3 shrink-0 rounded-full border-2 transition-colors duration-150 ease-out',
            selected
              ? 'border-success-foreground bg-success-foreground'
              : 'border-muted-foreground/40 bg-background',
          )}
        />
        <span className="flex min-w-0 flex-1 flex-col items-start gap-0 text-left">
          <span className="text-sm leading-snug font-medium">{label}</span>
          {description != null && description !== '' ? (
            <span className="text-muted-foreground pt-px text-xs leading-snug">{description}</span>
          ) : null}
        </span>
      </span>
    </Button>
  );
}

export { RadioCardGroup, RadioCard };
