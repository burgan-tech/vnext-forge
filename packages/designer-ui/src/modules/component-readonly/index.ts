/**
 * Shared read-only layer for component detail views, consumed by the
 * monitoring app via the designer-ui root barrel (`src/index.ts`).
 *
 * Read-only contract: the section components render live form controls with
 * no-op onChange handlers and take their `readOnly` state from
 * `FormReadOnlyContext`. Consumers must mount `<FormReadOnlyProvider>` around
 * them; otherwise the controls appear editable.
 *
 * Bundle-safety contract: nothing in this module may import `store/`,
 * `save-component/` (except pure types), `project-workspace/`,
 * `workspace-fs-events/`, or anything transport-bound. The only
 * module-crossing imports allowed are the pure `code-editor/editor/ScriptCodec`,
 * the pure `view-editor/viewContentHelpers` and `view-editor/viewPreviews`,
 * the verified store-free task-editor leaf forms listed in `TaskDetailCore`,
 * and the schema editor's tree surface (`schema-editor/components/tree-editor/`
 * plus `useSchemaEditorStore` / `useSchemaSelection`) used by
 * `SchemaDetailCore` — those stores are UI-local zustand singletons with no
 * transport or save path (like `useEditorValidationStore`); persistence lives
 * only in `SchemaEditorView` / `useSchemaEditor`, which this module never
 * mounts. Rendering that needs quick-run (the pseudo-ui view surface) is
 * injected by the host through a render prop — see
 * `ViewDetailCore.renderPseudoUiPreview`.
 * Mirrors `modules/canvas-interaction/readonly/`.
 */

export { normalizeDefinitionDoc, type ReadonlyComponentType } from './normalizeDefinitionDoc.js';

export {
  EXTENSION_SCOPE_LABELS,
  EXTENSION_TYPE_LABELS,
  FUNCTION_SCOPE_LABELS,
  TASK_TYPE_LABELS,
  VIEW_TYPE_LABELS,
} from './readonlyLabels.js';

export { ExtensionDetailCore, type ExtensionDetailCoreProps } from './ExtensionDetailCore.js';
export { FunctionDetailCore, type FunctionDetailCoreProps } from './FunctionDetailCore.js';
export { MappingDetailCore, type MappingDetailCoreProps } from './MappingDetailCore.js';
export { SchemaDetailCore, type SchemaDetailCoreProps } from './SchemaDetailCore.js';
export { TaskDetailCore, type TaskDetailCoreProps } from './TaskDetailCore.js';
export { ViewDetailCore, type ViewDetailCoreProps } from './ViewDetailCore.js';

export {
  ComponentRefCard,
  // Aliased: canvas-interaction/readonly already exports a (stricter) ComponentRef
  // from the same root barrel; this one allows a missing `key` for empty states.
  type ComponentRef as ReadonlyComponentRef,
  type ComponentRefCardProps,
} from './shared/ComponentRefCard.js';
export {
  ReadOnlyCodeField,
  type ReadOnlyCodeFieldProps,
} from './shared/ReadOnlyCodeField.js';
export { ReadOnlyConfigFields } from './shared/ReadOnlyConfigFields.js';
export {
  ReadOnlyMetadataSection,
  type ReadOnlyMetadataSectionProps,
} from './shared/ReadOnlyMetadataSection.js';
export {
  ReadOnlyScriptSection,
  type ReadOnlyScriptSectionProps,
} from './shared/ReadOnlyScriptSection.js';
export {
  noopChange,
  ReadOnlySectionCard,
  type ReadOnlySectionCardProps,
} from './shared/ReadOnlySectionCard.js';
export { ReadOnlyValueField } from './shared/ReadOnlyValueField.js';
export {
  asRecord,
  asScriptLike,
  asTaskExecution,
  type HelperRefLike,
  type ScriptLike,
  type TaskExecutionLike,
  type TaskRefLike,
} from './shared/readonlyGuards.js';
export { toDisplayText } from './shared/readonlyText.js';
