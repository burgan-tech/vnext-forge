import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Undo2, Redo2, Save } from 'lucide-react';

interface ComponentEditorLayoutProps {
  projectId: string;
  projectDomain?: string;
  typeName: string;
  group: string;
  name: string;
  isDirty: boolean;
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
  onSave,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  children,
}: ComponentEditorLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border px-3 py-1.5 flex items-center gap-3 text-xs shrink-0">
        <button
          onClick={() => navigate(`/project/${projectId}`)}
          className="text-muted-foreground hover:text-foreground"
        >
          {projectDomain || projectId}
        </button>
        <span className="text-muted-foreground">/</span>
        <span className="text-muted-foreground">{typeName}</span>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">{group}/{name}</span>
        {isDirty && <span className="text-muted-foreground ml-1">(modified)</span>}

        <div className="ml-auto flex items-center gap-1">
          {onUndo && (
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="p-1 rounded hover:bg-muted disabled:opacity-30"
              title="Undo"
            >
              <Undo2 size={14} />
            </button>
          )}
          {onRedo && (
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="p-1 rounded hover:bg-muted disabled:opacity-30"
              title="Redo"
            >
              <Redo2 size={14} />
            </button>
          )}
          <button
            onClick={onSave}
            disabled={!isDirty}
            className="p-1 rounded hover:bg-muted disabled:opacity-30"
            title="Save (Cmd+S)"
          >
            <Save size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
