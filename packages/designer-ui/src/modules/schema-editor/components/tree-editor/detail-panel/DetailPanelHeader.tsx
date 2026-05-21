import { ChevronRight, Home } from 'lucide-react';

import { Button } from '../../../../../ui/Button';
import { cn } from '../../../../../lib/utils/cn';
import { buildPointer, parsePointer, ROOT_POINTER, type JsonPointer } from '../../../model/jsonPointer';
import { useSetSelection } from '../../../hooks/useSchemaSelection';

interface BreadcrumbSegment {
  label: string;
  pointer: JsonPointer;
}

/**
 * Project a raw segment list (e.g. `['properties','foo','items','allOf','0']`)
 * into user-meaningful breadcrumb steps. `properties` and `prefixItems` are
 * collapsed into their following key/index, while standalone composition
 * keywords stay visible.
 */
function buildBreadcrumb(segments: string[]): BreadcrumbSegment[] {
  const out: BreadcrumbSegment[] = [];
  let consumed: string[] = [];
  let i = 0;

  while (i < segments.length) {
    const current = segments[i];

    if (current === 'properties' && i + 1 < segments.length) {
      const next = segments[i + 1];
      consumed = [...consumed, current, next];
      out.push({ label: next, pointer: buildPointer(consumed) });
      i += 2;
      continue;
    }

    if (current === 'prefixItems' && i + 1 < segments.length) {
      const next = segments[i + 1];
      consumed = [...consumed, current, next];
      out.push({ label: `prefixItems[${next}]`, pointer: buildPointer(consumed) });
      i += 2;
      continue;
    }

    if ((current === 'allOf' || current === 'anyOf' || current === 'oneOf') && i + 1 < segments.length) {
      const next = segments[i + 1];
      consumed = [...consumed, current, next];
      out.push({ label: `${current}[${next}]`, pointer: buildPointer(consumed) });
      i += 2;
      continue;
    }

    consumed = [...consumed, current];
    out.push({ label: current, pointer: buildPointer(consumed) });
    i += 1;
  }

  return out;
}

interface DetailPanelHeaderProps {
  pointer: JsonPointer;
}

export function DetailPanelHeader({ pointer }: DetailPanelHeaderProps) {
  const setSelection = useSetSelection();
  const segments = parsePointer(pointer);
  const crumbs = buildBreadcrumb(segments);

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
