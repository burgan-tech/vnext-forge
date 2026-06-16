import { useParams } from 'react-router-dom';

export function InstanceListPage() {
  const { wfId } = useParams<{ wfId: string }>();
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
      Instance List — {wfId} (coming soon)
    </div>
  );
}
