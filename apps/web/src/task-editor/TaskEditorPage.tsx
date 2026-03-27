import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useProjectStore } from '../stores/project-store';
import { useComponentStore } from '../stores/component-store';
import { useSaveComponent } from '../hooks/useSaveComponent';
import { ComponentEditorLayout } from '../components/ComponentEditorLayout';
import { TaskEditorPanel } from './TaskEditorPanel';

export function TaskEditorPage() {
  const { id, group, name } = useParams<{ id: string; group: string; name: string }>();
  const { activeProject, vnextConfig } = useProjectStore();
  const { componentJson, setComponent, isDirty, updateComponent, undo, redo, undoStack, redoStack } = useComponentStore();
  const { save } = useSaveComponent();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !group || !name || !activeProject || !vnextConfig) return;
    loadTask();
  }, [id, group, name, activeProject, vnextConfig]);

  async function loadTask() {
    if (!activeProject || !vnextConfig) return;
    setLoading(true);
    setError(null);
    try {
      const filePath = `${activeProject.path}/${vnextConfig.paths.componentsRoot}/${vnextConfig.paths.tasks}/${group}/${name}.json`;
      const res = await fetch(`/api/files?path=${encodeURIComponent(filePath)}`);
      if (!res.ok) throw new Error('Task file not found');
      const data = await res.json();
      const json = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
      setComponent(json, 'task', filePath);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  if (loading || !componentJson) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        {error || 'Loading task...'}
      </div>
    );
  }

  return (
    <ComponentEditorLayout
      projectId={id || ''}
      projectDomain={activeProject?.domain}
      typeName="Tasks"
      group={group || ''}
      name={name || ''}
      isDirty={isDirty}
      onSave={save}
      onUndo={undo}
      onRedo={redo}
      canUndo={undoStack.length > 0}
      canRedo={redoStack.length > 0}
    >
      <TaskEditorPanel json={componentJson} onChange={updateComponent} />
    </ComponentEditorLayout>
  );
}
