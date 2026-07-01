import { useLocation, useParams, Link } from 'react-router-dom';
import { RefreshCw, Star } from 'lucide-react';

import { Button } from '@vnext-forge-studio/designer-ui/ui';
import { cn } from '@monitoring/shared/lib/utils';
import { config } from '@monitoring/shared/config/config';
import { useFavorites } from '@monitoring/app/favorites/useFavorites';
import { TimeRangePicker } from '@monitoring/shared/time-range';
import { buildBreadcrumbs } from './breadcrumb-utils';

export function Topbar() {
  const location = useLocation();
  const params = useParams<Record<string, string>>();
  const { isFavorite, toggleFavorite } = useFavorites();

  const displayName = config.domain.charAt(0).toUpperCase() + config.domain.slice(1);
  const allCrumbs = buildBreadcrumbs(location.pathname, params, displayName);
  // Collapse middle crumbs when there are more than 3: Domain / … / second-to-last / last
  const crumbs =
    allCrumbs.length > 3
      ? [
          allCrumbs[0],
          { label: '…' },
          allCrumbs[allCrumbs.length - 2],
          allCrumbs[allCrumbs.length - 1],
        ]
      : allCrumbs;
  const isDashboard = location.pathname === '/';
  const currentLabel = crumbs[crumbs.length - 1]?.label ?? '';
  const currentFav = isFavorite(location.pathname);

  function handleFavToggle() {
    toggleFavorite({ path: location.pathname, label: currentLabel });
  }

  return (
    <header className="sticky top-0 z-10 flex h-[52px] shrink-0 items-center justify-between border-b border-border bg-card px-5">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            // Breadcrumbs are a fixed positional path that never reorders, and
            // labels are not guaranteed unique (e.g. a workflow key could equal
            // a static label), so the index is the correct stable key here.
            // eslint-disable-next-line react-x/no-array-index-key
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-muted-foreground">/</span>}
              {crumb.path && !isLast ? (
                <Link
                  to={crumb.path}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className={cn(isLast ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                  {crumb.label}
                </span>
              )}
            </span>
          );
        })}
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <TimeRangePicker />
        {!isDashboard && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleFavToggle}
            aria-label={currentFav ? 'Remove from favorites' : 'Add to favorites'}
            className="h-8 w-8"
          >
            <Star
              className={cn('h-4 w-4', currentFav && 'fill-current text-amber-500')}
            />
          </Button>
        )}
        <div className="flex h-2 w-2 items-center justify-center">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => window.location.reload()}
          aria-label="Refresh"
          className="h-8 w-8"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          U
        </div>
      </div>
    </header>
  );
}
