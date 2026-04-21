import type { ReactNode } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { useComponentStore } from '../../store/useComponentStore';
import { useLoadComponent } from '../../modules/save-component/useLoadComponent';
import { useSaveComponent } from '../../modules/save-component/useSaveComponent';
import { ComponentEditorLayout } from '../../modules/save-component/components/ComponentEditorLayout';
import { loadExtensionEditor } from './ExtensionEditorApi';
import { ExtensionEditorPanel } from './components/ExtensionEditorPanel';

export interface ExtensionEditorViewProps {
  projectId: string;
  group: string;
  name: string;
  registerToolbar?: (toolbar: ReactNode | null) => void;
}

export function ExtensionEditorView({
  projectId: id,
  group,
  name,
  registerToolbar,
}: ExtensionEditorViewProps) {
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
      registerToolbar={registerToolbar}
      isDirty={isDirty}
      hasSaved={!isDirty && undoStack.length > 0}
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
