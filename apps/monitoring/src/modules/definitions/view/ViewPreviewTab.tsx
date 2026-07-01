/**
 * Pseudo-ui integration stub for view component preview.
 *
 * When pseudo-ui is wired up, replace the placeholder below with:
 *
 *   import { PseudoUiViewSurface } from '@vnext-forge-studio/designer-ui/quickrun';
 *
 *   <PseudoUiViewSurface
 *     viewResponse={viewResponse}
 *     mode="preview"
 *     ariaLabel={`View preview: ${viewResponse.key}`}
 *     fillHeight={false}
 *   />
 *
 * `buildViewResponse` below constructs the ViewResponse shape that
 * PseudoUiViewSurface expects from the raw component definition data.
 */
import type { ViewResponse } from '@vnext-forge-studio/designer-ui/quickrun';
import { ViewRenderer } from '@vnext-forge-studio/vnext-types';

const VIEW_TYPE_STRING: Record<number, string> = {
  1: 'Json',
  2: 'Html',
  3: 'Markdown',
  4: 'Deeplink',
  5: 'Http',
  6: 'URN',
};

export function buildViewResponse(data: Record<string, unknown>): ViewResponse {
  const typeNum = data.type != null ? Number(data.type) : 1;
  return {
    key: String(data.key ?? ''),
    content: (data.content as Record<string, unknown>) ?? data,
    type: VIEW_TYPE_STRING[typeNum] ?? 'Json',
    display: data.display ? String(data.display) : undefined,
    renderer: data.renderer ? String(data.renderer) : ViewRenderer.PseudoUi,
  };
}

interface ViewPreviewTabProps {
  data: Record<string, unknown>;
}

export function ViewPreviewTab({ data }: ViewPreviewTabProps) {
  const viewResponse = buildViewResponse(data);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border bg-muted/10 p-6">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">Visual Preview</p>
      </div>
      <p className="text-xs text-muted-foreground/70">
        Pseudo-UI renderer will be integrated here.{' '}
        <span className="font-mono">renderer: {viewResponse.renderer ?? '—'}</span>
        {' · '}
        <span className="font-mono">type: {viewResponse.type}</span>
      </p>
      <pre className="max-h-48 overflow-auto rounded border border-border bg-muted/20 p-3 text-xs font-mono text-muted-foreground">
        {JSON.stringify(viewResponse.content, null, 2)}
      </pre>
    </div>
  );
}
