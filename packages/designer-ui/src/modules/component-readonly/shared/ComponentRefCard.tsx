import { Badge } from '../../../ui/Badge.js';

export interface ComponentRef {
  key?: string;
  domain?: string;
  version?: string;
  flow?: string;
}

export interface ComponentRefCardProps {
  refValue: ComponentRef | null | undefined;
  order?: number;
  onNavigate?: (ref: ComponentRef) => void;
}

export function ComponentRefCard({ refValue, order, onNavigate }: ComponentRefCardProps) {
  if (!refValue?.key) {
    return <div className="text-muted-foreground text-sm">No task configured.</div>;
  }

  const body = (
    <div className="border-border bg-muted/20 flex items-center gap-2 rounded-lg border p-2 text-sm">
      {order !== undefined && (
        <Badge variant="outline" className="text-xs">
          #{order}
        </Badge>
      )}
      <span className="font-mono">{refValue.key}</span>
      {refValue.domain && <span className="text-muted-foreground">@{refValue.domain}</span>}
      {refValue.version && <span className="text-muted-foreground">v{refValue.version}</span>}
      {refValue.flow && (
        <Badge variant="secondary" className="text-xs">
          {refValue.flow}
        </Badge>
      )}
    </div>
  );

  if (!onNavigate) return body;

  return (
    <button
      type="button"
      className="block w-full cursor-pointer text-left"
      onClick={() => onNavigate(refValue)}
      aria-label={`Open ${refValue.key}`}>
      {body}
    </button>
  );
}
