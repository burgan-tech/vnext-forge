import * as React from 'react';
import { Copy } from 'lucide-react';

import { Button } from '@shared/ui/button';
import { cn } from '@shared/lib/utils/cn';

interface InfoRowProps extends React.ComponentProps<'div'> {
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
      className={cn('flex items-start gap-3 py-1.5', className)}
      {...props}
    >
      {label ? (
        <div className="text-muted-foreground w-24 shrink-0 text-xs font-medium">{label}</div>
      ) : null}
      <div
        className={cn(
          'min-w-0 flex-1 break-all text-sm',
          mono && 'bg-muted rounded-md px-2 py-1 font-mono text-xs',
        )}
      >
        {value}
      </div>
      {copyable && typeof value === 'string' ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={copyValue}
          className="size-7 shrink-0"
          aria-label="Copy value"
        >
          <Copy className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}

export { InfoRow };
