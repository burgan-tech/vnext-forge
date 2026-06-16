import { useParams } from 'react-router-dom';

export function InstanceDetailPage() {
  const { instanceId } = useParams<{ instanceId: string }>();
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
      Instance Detail — {instanceId} (coming soon)
    </div>
  );
}
