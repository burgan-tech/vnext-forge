import type { ReactNode } from 'react';

/**
 * VNext belge editörlerinin (task, view, flow, …) dış “host”ta Save / Modified / Undo
 * arayüzünü nereye iliştireceğini söyler.
 *
 * - **Web Flow Studio** (`apps/web`): `setToolbar` — sekme satırının sağındaki slota
 *   `ReactNode` koyar (`ProjectEditorShell`).
 * - **VS Code webview** (`apps/extension/…`): Prop verilmez; aynı kontroller
 *   `ComponentEditorLayout` içinde, editör panelinin üst şeridinde (`editor-chrome`) çizilir.
 */
export type HostDocumentToolbarSlot = (node: ReactNode | null) => void;
