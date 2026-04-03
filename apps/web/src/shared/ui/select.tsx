import * as React from 'react';
import { cn } from '@shared/lib/utils/cn';

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const Select = ({ className, children, ...props }: SelectProps) => {
  return (
    <select
      className={cn(
        'bg-appCardBackground border-appBorderColor-300 text-appTextHeader h-10 w-full rounded-md border px-3 text-sm',
        'focus-visible:border-appFocused-400 focus-visible:ring-appFocused-300/40 focus-visible:outline-none focus-visible:ring-2',
        className,
      )}
      {...props}>
      {children}
    </select>
  );
};

export { Select };
