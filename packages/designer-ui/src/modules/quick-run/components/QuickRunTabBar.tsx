import { useCallback, useEffect, useRef, useState } from 'react';

import { useQuickRunStore } from '../store/quickRunStore';
import { EnvBadge } from './EnvBadge';

interface ContextMenuState {
  x: number;
  y: number;
  instanceId: string;
}

export function QuickRunTabBar() {
  const tabs = useQuickRunStore((s) => s.tabs);
  const activeTabId = useQuickRunStore((s) => s.activeTabId);
  const setActiveTab = useQuickRunStore((s) => s.setActiveTab);
  const removeTab = useQuickRunStore((s) => s.removeTab);
  const removeAllTabs = useQuickRunStore((s) => s.removeAllTabs);
  const removeOtherTabs = useQuickRunStore((s) => s.removeOtherTabs);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, instanceId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, instanceId });
  }, []);

  const closeMenu = useCallback(() => setContextMenu(null), []);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu, closeMenu]);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [contextMenu, closeMenu]);

  if (tabs.length <= 1) return null;

  return (
    <>
      <div
        className="flex items-center gap-0 overflow-x-auto border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-editorGroupHeader-tabsBackground)]"
        role="tablist"
      >
        {tabs.map((tab) => (
          <button
            key={tab.instanceId}
            role="tab"
            aria-selected={tab.instanceId === activeTabId}
            tabIndex={tab.instanceId === activeTabId ? 0 : -1}
            className={`group flex items-center gap-1.5 border-r border-[var(--vscode-panel-border)] px-3 py-1.5 text-xs focus-visible:outline focus-visible:outline-[var(--vscode-focusBorder)] ${
              tab.instanceId === activeTabId
                ? 'border-b-2 border-b-[var(--vscode-tab-activeBorderTop)] bg-[var(--vscode-tab-activeBackground)] text-[var(--vscode-tab-activeForeground)]'
                : 'text-[var(--vscode-tab-inactiveForeground)] hover:bg-[var(--vscode-tab-hoverBackground)]'
            }`}
            onClick={() => setActiveTab(tab.instanceId)}
            onContextMenu={(e) => handleContextMenu(e, tab.instanceId)}
          >
            <span className="truncate max-w-[120px]">{tab.label}</span>
            {tab.environmentName && <EnvBadge name={tab.environmentName} />}
            <span
              role="button"
              tabIndex={0}
              className="ml-1 hidden h-4 w-4 items-center justify-center rounded text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-list-hoverBackground)] hover:text-[var(--vscode-foreground)] group-hover:inline-flex group-focus-within:inline-flex"
              onClick={(e) => {
                e.stopPropagation();
                removeTab(tab.instanceId);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  removeTab(tab.instanceId);
                }
              }}
              aria-label={`Close ${tab.label}`}
            >
              ×
            </span>
          </button>
        ))}
      </div>

      {contextMenu && (
        // Inline context menu — earlier iterations used `--vscode-menu-*`
        // and then theme tokens (`bg-popover`), both of which still
        // rendered transparent in the Electron shell when the host
        // didn't have the underlying CSS variables wired up. To make
        // this menu robust regardless of theme variable plumbing we
        // hard-code VS Code dark palette values inline.
        <div
          ref={menuRef}
          role="menu"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            backgroundColor: '#252526',
            border: '1px solid #3c3c3c',
            color: '#cccccc',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
          }}
          className="fixed z-[9999] min-w-[160px] rounded-md py-1"
        >
          <ContextMenuRow
            label="Close"
            onClick={() => {
              removeTab(contextMenu.instanceId);
              closeMenu();
            }}
          />
          <ContextMenuRow
            label="Close Others"
            onClick={() => {
              removeOtherTabs(contextMenu.instanceId);
              closeMenu();
            }}
          />
          <div style={{ borderTop: '1px solid #3c3c3c' }} className="my-1" />
          <ContextMenuRow
            label="Close All"
            onClick={() => {
              removeAllTabs();
              closeMenu();
            }}
          />
        </div>
      )}
    </>
  );
}

/**
 * Single context-menu row with explicit hover handling — `:hover` via
 * the `style` prop isn't possible, so we manage hover state here. Hard-
 * coded VS Code dark palette to match the surrounding menu container.
 */
function ContextMenuRow({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      role="menuitem"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        backgroundColor: hover ? '#094771' : 'transparent',
        color: hover ? '#ffffff' : '#cccccc',
      }}
      className="w-full px-3 py-1.5 text-left text-xs"
    >
      {label}
    </button>
  );
}
