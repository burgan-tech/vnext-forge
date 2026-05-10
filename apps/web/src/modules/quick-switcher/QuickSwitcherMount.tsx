import { useCallback } from 'react';

import { useNavigate } from 'react-router-dom';

import {
  QuickSwitcher,
  useGlobalQuickSwitcherShortcut,
  useProjectStore,
  useQuickSwitcherStore,
  type QuickSwitchEntry,
} from '@vnext-forge-studio/designer-ui';

import { resolveFileRoute } from '../project-workspace/FileRouter';

import { useDesktopMenuShortcutBridge } from './useDesktopMenuShortcutBridge';
import { useGlobalContentSearchShortcut } from './useGlobalContentSearchShortcut';

/**
 * Web shell mount for the host-agnostic Quick Switcher palette. Wires the
 * global Cmd+P shortcut to the active project, and routes a picked entry
 * to the matching editor page via `resolveFileRoute()`.
 *
 * Intentionally trivial: every navigation/file/route concern lives in the
 * web shell so designer-ui stays router-free for the VS Code webview.
 */
export function QuickSwitcherMount() {
  const navigate = useNavigate();
  const activeProject = useProjectStore((s) => s.activeProject);
  const vnextConfig = useProjectStore((s) => s.vnextConfig);
  const close = useQuickSwitcherStore((s) => s.close);

  // Native menu accelerators (Electron desktop only). Win at the OS level over
  // DevTools and Chromium internals, so they're the canonical path.
  useDesktopMenuShortcutBridge();
  // Renderer keydown listeners — kept as a fallback for the vite dev server
  // and VS Code webview shells where the native menu doesn't exist.
  useGlobalQuickSwitcherShortcut({ projectId: activeProject?.id ?? null });
  useGlobalContentSearchShortcut();

  const handleSelect = useCallback(
    (entry: QuickSwitchEntry) => {
      if (!activeProject) {
        close();
        return;
      }
      const route = resolveFileRoute(
        entry.filePath,
        vnextConfig,
        activeProject.id,
        activeProject.path,
      );
      if (route.navigateTo) {
        navigate(route.navigateTo);
      }
      // The QuickSwitcher closes itself after onSelect returns; no extra
      // close() needed. Future deep-linking to specific state/transition
      // will pass extra hash/query params here.
    },
    [activeProject, vnextConfig, navigate, close],
  );

  // Without an active project the palette can't open (shortcut hook is a
  // no-op), but we still mount the component so the dialog primitive is
  // ready when the user lands on a project.
  return <QuickSwitcher onSelect={handleSelect} />;
}
