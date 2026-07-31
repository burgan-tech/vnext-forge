import { Skeleton } from '@vnext-forge-studio/designer-ui/ui';

import { cn } from '@monitoring/shared/lib/utils';

/** Bar heights (in % of the plot area) that stand in for a time series. */
const BAR_HEIGHTS = [40, 65, 50, 80, 60, 90, 70, 55, 75, 45];

interface ChartSkeletonProps {
  /** Tailwind height class matching the real chart's plot area. */
  heightClass?: string;
}

/** Footprint-compatible with the dashboard activity chart plot area. */
export function ChartSkeleton({ heightClass = 'h-[120px]' }: ChartSkeletonProps) {
  return (
    <div className={cn('flex w-full items-end gap-2', heightClass)} aria-busy="true">
      {BAR_HEIGHTS.map((height) => (
        <Skeleton key={height} className="w-full" style={{ height: `${height}%` }} />
      ))}
    </div>
  );
}
