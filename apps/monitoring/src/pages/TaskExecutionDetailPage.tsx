import { useParams } from 'react-router-dom';

export function TaskExecutionDetailPage() {
  const { execId } = useParams<{ execId: string }>();
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
      Task Execution Detail — {execId} (coming soon)
    </div>
  );
}
