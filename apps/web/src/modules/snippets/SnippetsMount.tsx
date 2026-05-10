import {
  SnippetPicker,
  useGlobalSnippetPickerShortcut,
  useProjectStore,
} from '@vnext-forge-studio/designer-ui';

/**
 * Web shell mount for the snippet picker overlay. The sidebar panel mounts
 * separately via `useWebShellStore.sidebarView === 'snippets'`. Cmd+Shift+S
 * is registered here as a JS-keydown fallback for the vite dev server and
 * the VS Code webview; the desktop shell prefers the native menu accelerator
 * (`apps/desktop/src/menu.ts` → "Insert Snippet…") which routes through
 * `useDesktopMenuShortcutBridge`.
 */
export function SnippetsMount() {
  const activeProject = useProjectStore((s) => s.activeProject);
  useGlobalSnippetPickerShortcut();
  return <SnippetPicker projectId={activeProject?.id ?? null} />;
}
