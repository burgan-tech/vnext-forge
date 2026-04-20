// Top-level barrel for @vnext-forge/designer-ui.
// Host shells (apps/web SPA, apps/extension webview) import from here OR from
// the more specific subpath exports declared in package.json (./ui, ./hooks,
// ./lib, ./notification, ./api, ./styles.css).

export * from './app/index.js';
export * from './api/index.js';
export * from './hooks/index.js';
export * from './lib/index.js';
export * from './notification/index.js';
export * from './ui/index.js';
export * from './store/index.js';

// Shared project/workspace types consumed by editor views AND by host shells
// (the web SPA ships its own project list / file tree / wizards built on top
// of these types; the VS Code extension only uses a subset of them).
export * from './shared/index.js';

// Shared workspace API + schema helpers. These are host-agnostic wrappers
// over `ApiTransport`, so every consumer (editor view, web shell, extension
// webview) talks to its backend through the same contract.
export * from './modules/project-workspace/WorkspaceApi.js';
export * from './modules/project-workspace/ProjectWorkspaceSchema.js';

// Router-agnostic editor views: each editor takes
// `{ projectId, group, name }` props so a host can render it directly
// without depending on react-router. The web SPA wraps these in router
// pages; the VS Code webview renders them in response to a host message
// describing which file the user opened.
export {
  FlowEditorView,
  type FlowEditorViewProps,
} from './modules/flow-editor/FlowEditorView.js';
export {
  TaskEditorView,
  type TaskEditorViewProps,
} from './modules/task-editor/TaskEditorView.js';
export {
  SchemaEditorView,
  type SchemaEditorViewProps,
} from './modules/schema-editor/SchemaEditorView.js';
export {
  ViewEditorView,
  type ViewEditorViewProps,
} from './modules/view-editor/ViewEditorView.js';
export {
  FunctionEditorView,
  type FunctionEditorViewProps,
} from './modules/function-editor/FunctionEditorView.js';
export {
  ExtensionEditorView,
  type ExtensionEditorViewProps,
} from './modules/extension-editor/ExtensionEditorView.js';

// Workflow-execution APIs/hooks (runtime health). The whole module lives in
// designer-ui — host shells (apps/web SPA, apps/extension webview) consume
// the API/schema helpers, the hooks AND the `RuntimeHealthSync` mount
// component from here.
export * from './modules/workflow-execution/WorkflowExecutionApi.js';
export * from './modules/workflow-execution/WorkflowExecutionSchema.js';
export { useRuntimeHealth } from './modules/workflow-execution/useRuntimeHealth.js';
export { useRuntimeRevalidator } from './modules/workflow-execution/useRuntimeRevalidator.js';
export { RuntimeHealthSync } from './modules/workflow-execution/RuntimeHealthSync.js';

// Code-editor primitives. The whole module stays shared because editor views
// (FlowEditorView etc.) embed the Monaco + C# script panel. Host shells can
// also consume a small subset (e.g. the web `CodeEditorPage` reuses
// `useEditorStore` and `setupMonacoWithLsp`).
export { useEditorStore, type EditorTab } from './modules/code-editor/EditorStore.js';
export { useSaveFile } from './modules/code-editor/useSaveFile.js';
export { setupMonacoWithLsp } from './modules/code-editor/editor/MonacoSetup.js';
export type { CsharpLspClient } from './modules/code-editor/editor/lspClient.js';

// Shared workflow-validation primitives. Surfaced so host shells can render
// aggregated diagnostics (e.g. the web StatusBar popover).
export type {
  ValidationIssue,
  WorkflowValidationResult,
  WorkflowValidationResponse,
} from './modules/workflow-validation/WorkflowValidationTypes.js';

export type { HostEditorCapabilities } from './lsp/HostEditorCapabilities.js';
export {
  setHostEditorCapabilities,
  getHostEditorCapabilities,
} from './lsp/hostEditorCapabilitiesRegistry.js';
