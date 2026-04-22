import type { HostDocumentToolbarSlot } from '../../modules/save-component/components/hostDocumentToolbarSlot';
import { useProjectStore } from '../../store/useProjectStore';
import { useComponentStore } from '../../store/useComponentStore';
import { useSaveComponent } from '../../modules/save-component/useSaveComponent';
import { ComponentEditorLayout } from '../../modules/save-component/components/ComponentEditorLayout';
import { useFunctionEditor } from './UseFunctionEditor';
import { FunctionEditorPanel } from './components/FunctionEditorPanel';

export interface FunctionEditorViewProps {
  projectId: string;
  group: string;
  name: string;
  registerToolbar?: HostDocumentToolbarSlot;
}

export function FunctionEditorView({
  projectId: id,
  group,
  name,
  registerToolbar,
}: FunctionEditorViewProps) {
  const { activeProject, vnextConfig } = useProjectStore();
  const {
    componentJson,
    filePath: componentFilePath,
    isDirty,
    updateComponent,
    undo,
    redo,
    undoStack,
    redoStack,
  } = useComponentStore();
  const { save, saving, saveError } = useSaveComponent();
  const filePath =
    id && group && name && activeProject && vnextConfig
      ? `${activeProject.path}/${vnextConfig.paths.componentsRoot}/${vnextConfig.paths.functions}/${group}/${name}.json`
      : null;
  const { loading, error, functionDocument } = useFunctionEditor({ filePath });
  const isEditorReady = Boolean(
    functionDocument && componentJson && componentFilePath === filePath,
  );

  if (loading || !isEditorReady || !componentJson) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        {error?.toUserMessage().message || 'Loading function...'}
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
      <FunctionEditorPanel json={componentJson} onChange={updateComponent} />
    </ComponentEditorLayout>
  );
}
