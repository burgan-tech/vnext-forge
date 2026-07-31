import { Skeleton } from '@vnext-forge-studio/designer-ui/ui';

/** Footprint-compatible with KpiCard (label row + big value). */
export function KpiCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-sm" aria-busy="true">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-9 w-16" />
    </div>
  );
}
