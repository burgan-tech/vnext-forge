import * as React from 'react';

import { cn } from '../lib/utils/cn.js';

export type SkeletonProps = React.ComponentProps<'div'>;

/**
 * Theme-aware shimmer placeholder. Size it with utility classes
 * (`h-4 w-32`, `h-full`, …); it mimics the footprint of the content
 * it stands in for so layout does not jump when data arrives.
 */
function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn('bg-muted animate-pulse rounded-md motion-reduce:animate-none', className)}
      {...props}
    />
  );
}

export { Skeleton };
