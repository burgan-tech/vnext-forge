import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Copy } from 'lucide-react';

import { Button } from '@shared/ui/Button';
import { cn } from '@shared/lib/utils/Cn';

const infoRowVariants = cva('flex items-start gap-3 py-1.5', {
  variants: {
    variant: {
      default: '',
      secondary: '',
      tertiary: '',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const infoRowLabelVariants = cva('w-24 shrink-0 text-xs font-medium', {
  variants: {
    variant: {
      default: 'text-primary-text/70',
      secondary: 'text-secondary-text/70',
      tertiary: 'text-tertiary-text/70',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const infoRowValueVariants = cva('min-w-0 flex-1 break-all text-sm', {
  variants: {
    variant: {
      default: 'text-primary-text',
      secondary: 'text-secondary-text',
      tertiary: 'text-tertiary-text',
    },
    mono: {
      true: '',
      false: '',
    },
  },
  compoundVariants: [
    {
      variant: 'default',
      mono: true,
      className: 'rounded-md bg-primary-muted/70 px-2 py-1 font-mono text-xs',
    },
    {
      variant: 'secondary',
      mono: true,
      className: 'rounded-md bg-secondary-muted/70 px-2 py-1 font-mono text-xs',
    },
    {
      variant: 'tertiary',
      mono: true,
      className: 'rounded-md bg-tertiary-muted/70 px-2 py-1 font-mono text-xs',
    },
  ],
  defaultVariants: {
    variant: 'default',
    mono: false,
  },
});

interface InfoRowProps extends React.ComponentProps<'div'>, VariantProps<typeof infoRowVariants> {
  copyable?: boolean;
  label?: React.ReactNode;
  mono?: boolean;
  value: React.ReactNode;
}

function InfoRow({
  className,
  copyable = false,
  label,
  mono = false,
  variant,
  value,
  ...props
}: InfoRowProps) {
  async function copyValue() {
    if (typeof value !== 'string') {
      return;
    }

    await navigator.clipboard.writeText(value);
  }

  if (value === null || value === undefined || value === '') {
    return null;
  }

  return (
    <div
      data-slot="info-row"
      className={cn(infoRowVariants({ variant }), className)}
      {...props}
    >
      {label ? (
        <div className={cn(infoRowLabelVariants({ variant }))}>{label}</div>
      ) : null}
      <div className={cn(infoRowValueVariants({ variant, mono }))}>
        {value}
      </div>
      {copyable && typeof value === 'string' ? (
        <Button
          type="button"
          variant={variant ?? 'default'}
          size="icon"
          onClick={copyValue}
          noBorder
          noIconHover
          className="size-7 shrink-0"
          aria-label="Copy value"
        >
          <Copy className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}

export { InfoRow, infoRowVariants };
