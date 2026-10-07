import {
  PanelBottom,
  PanelBottomClose,
  PanelLeft,
  PanelLeftClose,
  PanelRight,
  PanelRightClose,
} from 'lucide-react';

interface PanelToggleButtonProps {
  side: 'left' | 'right' | 'bottom';
  open: boolean;
  onToggle: () => void;
  label: string;
}

const ICONS = {
  left: { open: PanelLeftClose, closed: PanelLeft },
  right: { open: PanelRightClose, closed: PanelRight },
  bottom: { open: PanelBottomClose, closed: PanelBottom },
} as const;

export function PanelToggleButton({ side, open, onToggle, label }: PanelToggleButtonProps) {
  const Icon = open ? ICONS[side].open : ICONS[side].closed;
  const text = `${open ? 'Hide' : 'Show'} ${label}`;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={open}
      aria-label={text}
      title={text}
      className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded text-[var(--vscode-icon-foreground,var(--vscode-foreground))] hover:bg-[var(--vscode-toolbar-hoverBackground,rgba(128,128,128,0.2))] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--vscode-focusBorder)]"
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  );
}
