import { useParams } from 'react-router-dom';

export function DefinitionsPage() {
  const { type } = useParams<{ type: string }>();
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
      Definitions — {type} (coming soon)
    </div>
  );
}
