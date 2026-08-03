import { Skeleton } from '@vnext-forge-studio/designer-ui/ui';

/** Mimics the detail page footprint: header row, tab strip, two cards. */
export function DetailPageSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <Skeleton className="h-10 w-full max-w-md" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
