import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { VnextForgeError } from '@vnext-forge/app-contracts';
import { useProjectStore } from '@modules/project-management/ProjectStore';
import { useComponentStore } from '@modules/save-component/ComponentStore';
import { useSaveComponent } from '@modules/save-component/UseSaveComponent';
import { ComponentEditorLayout } from '@modules/save-component/components/ComponentEditorLayout';
import { readFile } from '@modules/project-workspace/WorkspaceApi';
import { ExtensionEditorPanel } from './ExtensionEditorPanel';

export function ExtensionEditorView() {
  const { id, group, name } = useParams<{ id: string; group: string; name: string }>();
  const { activeProject, vnextConfig } = useProjectStore();
  const { componentJson, setComponent, isDirty, updateComponent, undo, redo, undoStack, redoStack } = useComponentStore();
  const { save } = useSaveComponent();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !group || !name || !activeProject || !vnextConfig) return;
    loadExtension();
  }, [id, group, name, activeProject, vnextConfig]);

  async function loadExtension() {
    if (!activeProject || !vnextConfig) return;
    setLoading(true);
    setError(null);
    try {
      const filePath = `${activeProject.path}/${vnextConfig.paths.componentsRoot}/${vnextConfig.paths.extensions}/${group}/${name}.json`;
      const data = await readFile(filePath);
      const json = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
      setComponent(json, 'extension', filePath);
    } catch (err) {
      if (err instanceof VnextForgeError) {
        setError(err.toUserMessage().message);
      } else {
        setError('Failed to load extension');
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading || !componentJson) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        {error || 'Loading extension...'}
      </div>
    );
  }

  return (
    <ComponentEditorLayout
      projectId={id || ''}
      projectDomain={activeProject?.domain}
      typeName="Extensions"
      group={group || ''}
      name={name || ''}
      isDirty={isDirty}
      onSave={save}
      onUndo={undo}
      onRedo={redo}
      canUndo={undoStack.length > 0}
      canRedo={redoStack.length > 0}
    >
      <ExtensionEditorPanel json={componentJson} onChange={updateComponent} />
    </ComponentEditorLayout>
  );
}
