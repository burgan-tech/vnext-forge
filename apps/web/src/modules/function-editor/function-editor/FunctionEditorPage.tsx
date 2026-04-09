import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useProjectStore } from '@modules/project-management/ProjectStore';
import { useComponentStore } from '@modules/save-component/ComponentStore';
import { useSaveComponent } from '@modules/save-component/UseSaveComponent';
import { ComponentEditorLayout } from '@modules/save-component/components/ComponentEditorLayout';
import { readFile } from '@modules/project-workspace/WorkspaceApi';
import { FunctionEditorPanel } from './FunctionEditorPanel';

export function FunctionEditorPage() {
  const { id, group, name } = useParams<{ id: string; group: string; name: string }>();
  const { activeProject, vnextConfig } = useProjectStore();
  const { componentJson, setComponent, isDirty, updateComponent, undo, redo, undoStack, redoStack } = useComponentStore();
  const { save } = useSaveComponent();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !group || !name || !activeProject || !vnextConfig) return;
    loadFunction();
  }, [id, group, name, activeProject, vnextConfig]);

  async function loadFunction() {
    if (!activeProject || !vnextConfig) return;
    setLoading(true);
    setError(null);
    try {
      const filePath = `${activeProject.path}/${vnextConfig.paths.componentsRoot}/${vnextConfig.paths.functions}/${group}/${name}.json`;
      const data = await readFile(filePath);
      const json = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
      setComponent(json, 'function', filePath);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  if (loading || !componentJson) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        {error || 'Loading function...'}
      </div>
    );
  }

  return (
    <ComponentEditorLayout
      projectId={id || ''}
      projectDomain={activeProject?.domain}
      typeName="Functions"
      group={group || ''}
      name={name || ''}
      isDirty={isDirty}
      onSave={save}
      onUndo={undo}
      onRedo={redo}
      canUndo={undoStack.length > 0}
      canRedo={redoStack.length > 0}
    >
      <FunctionEditorPanel json={componentJson} onChange={updateComponent} />
    </ComponentEditorLayout>
  );
}
