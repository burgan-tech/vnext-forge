import { ChevronRight, Home } from 'lucide-react';

import { Button } from '../../../../../ui/Button';
import { cn } from '../../../../../lib/utils/cn';
import { buildBreadcrumb } from '../../../model/breadcrumb';
import { ROOT_POINTER, type JsonPointer } from '../../../model/jsonPointer';
import { useSetSelection } from '../../../hooks/useSchemaSelection';

interface DetailPanelHeaderProps {
  pointer: JsonPointer;
}

export function DetailPanelHeader({ pointer }: DetailPanelHeaderProps) {
  const setSelection = useSetSelection();
  const crumbs = buildBreadcrumb(pointer);

  return (
    <nav
      aria-label="Selection breadcrumb"
      className="flex flex-wrap items-center gap-1 border-b border-primary-border px-3 py-2 text-xs">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          'h-6 gap-1 px-1.5 text-[11px]',
          pointer === ROOT_POINTER && 'font-semibold text-primary-text',
        )}
        onClick={() => setSelection(ROOT_POINTER)}>
        <Home size={11} />
        root
      </Button>

      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <span key={crumb.pointer} className="flex items-center gap-1">
            <ChevronRight aria-hidden size={11} className="text-primary-text/40" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                'h-6 px-1.5 font-mono text-[11px]',
                isLast && 'font-semibold text-primary-text',
              )}
              onClick={() => setSelection(crumb.pointer)}>
              {crumb.label}
            </Button>
          </span>
        );
      })}
    </nav>
  );
}
