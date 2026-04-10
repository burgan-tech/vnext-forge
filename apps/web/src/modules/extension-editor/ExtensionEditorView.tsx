import { useParams } from 'react-router-dom';
import { useProjectStore } from '@app/store/useProjectStore';
import { useComponentStore } from '@app/store/useComponentStore';
import { useLoadComponent } from '@modules/save-component/useLoadComponent';
import { useSaveComponent } from '@modules/save-component/useSaveComponent';
import { ComponentEditorLayout } from '@modules/save-component/components/ComponentEditorLayout';
import { loadExtensionEditor } from './ExtensionEditorApi';
import { ExtensionEditorPanel } from './components/ExtensionEditorPanel';

export function ExtensionEditorView() {
  const { id, group, name } = useParams<{ id: string; group: string; name: string }>();
  const { activeProject, vnextConfig } = useProjectStore();
  const { componentJson, isDirty, updateComponent, undo, redo, undoStack, redoStack } =
    useComponentStore();
  const { save, saving, saveError } = useSaveComponent();
  const filePath =
    id && group && name && activeProject && vnextConfig
      ? `${activeProject.path}/${vnextConfig.paths.componentsRoot}/${vnextConfig.paths.extensions}/${group}/${name}.json`
      : null;
  const { loading, error, isReady } = useLoadComponent({
    filePath,
    componentType: 'extension',
    loadComponent: loadExtensionEditor,
    createArgs: (nextFilePath) => ({ filePath: nextFilePath }),
    errorMessage: 'Extension could not be loaded.',
  });

  if (loading || !isReady || !componentJson) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        {error?.toUserMessage().message || 'Loading extension...'}
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
      saving={saving}
      saveErrorMessage={saveError?.toUserMessage().message ?? null}
      onSave={save}
      onUndo={undo}
      onRedo={redo}
      canUndo={undoStack.length > 0}
      canRedo={redoStack.length > 0}>
      <ExtensionEditorPanel json={componentJson} onChange={updateComponent} />
    </ComponentEditorLayout>
  );
}
