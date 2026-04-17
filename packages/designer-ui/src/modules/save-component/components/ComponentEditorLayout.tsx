import type { ReactNode } from 'react';
import { AlertCircle, Save, Undo2, Redo2 } from 'lucide-react';
import { Button } from '../../../ui/Button';
import { Alert, AlertDescription } from '../../../ui/Alert';
import { useProjectNavigation } from '../../../app/HostNavigationContext';

interface ComponentEditorLayoutProps {
  projectId: string;
  projectDomain?: string;
  typeName: string;
  group: string;
  name: string;
  isDirty: boolean;
  hasSaved?: boolean;
  saving?: boolean;
  saveErrorMessage?: string | null;
  onSave: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  children: ReactNode;
}

export function ComponentEditorLayout({
  projectId,
  projectDomain,
  typeName,
  group,
  name,
  isDirty,
  hasSaved = false,
  saving = false,
  saveErrorMessage = null,
  onSave,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  children,
}: ComponentEditorLayoutProps) {
  const navigation = useProjectNavigation();

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-background px-3 py-2 text-xs shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          {navigation ? (
            <button
              type="button"
              onClick={() => {
                navigation.navigateToProject(projectId);
              }}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {projectDomain ?? projectId}
            </button>
          ) : (
            <span className="text-muted-foreground">{projectDomain ?? projectId}</span>
          )}
          <span className="text-muted-foreground/60">/</span>
          <span className="rounded-full border border-border bg-muted/40 px-3 py-1 font-medium text-foreground">
            {typeName}
          </span>
          <span className="text-muted-foreground/60">/</span>
          <span className="rounded-full border border-border bg-background px-3 py-1 font-medium text-foreground">
            {group}/{name}
          </span>
          {isDirty ? (
            <span className="rounded-full border border-warning-border bg-warning-surface px-3 py-1 font-medium text-warning-text">
              Modified
            </span>
          ) : hasSaved ? (
            <span className="rounded-full border border-success-border bg-success-surface px-3 py-1 font-medium text-success-text">
              Saved
            </span>
          ) : (
            <span className="rounded-full border border-border bg-muted/40 px-3 py-1 font-medium text-muted-foreground">
              No change
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {onUndo && (
              <Button
                type="button"
                onClick={onUndo}
                disabled={!canUndo}
                variant="muted"
                size="sm"
                className="min-w-8"
                title="Undo"
              >
                <Undo2 size={14} />
              </Button>
            )}
            {onRedo && (
              <Button
                type="button"
                onClick={onRedo}
                disabled={!canRedo}
                variant="muted"
                size="sm"
                className="min-w-8"
                title="Redo"
              >
                <Redo2 size={14} />
              </Button>
            )}
            <Button
              type="button"
              onClick={onSave}
              disabled={!isDirty || saving}
              variant="success"
              size="sm"
              leftIconComponent={<Save size={14} />}
              title="Save (Cmd+S)"
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
        {saveErrorMessage ? (
          <Alert variant="destructive" className="mt-2 py-2">
            <AlertCircle />
            <AlertDescription className="truncate font-medium">
              {saveErrorMessage}
            </AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
