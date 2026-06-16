import { useParams } from 'react-router-dom';

export function ComponentDetailPage() {
  const { type, id } = useParams<{ type: string; id: string }>();
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
      {type} Detail — {id} (coming soon)
    </div>
  );
}
