import { cn } from '@vnext-forge/designer-ui';

/**
 * Lightweight placeholder while lazy route chunks load.
 */
export function RouteSkeleton({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        'flex min-h-[40vh] w-full flex-1 items-center justify-center bg-background p-8',
        className,
      )}>
      <div className="bg-muted-foreground/15 h-24 w-full max-w-md animate-pulse rounded-xl" />
    </div>
  );
}
