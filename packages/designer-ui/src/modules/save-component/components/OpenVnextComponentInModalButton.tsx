import { useState } from 'react';
import { SquareArrowOutUpRight } from 'lucide-react';

import { useProjectStore } from '../../../store/useProjectStore.js';
import { showNotification } from '../../../notification/notification-port.js';
import { resolveComponentEditorTargetByKeyFlowResult } from '../../vnext-workspace/resolveComponentEditorRoute.js';
import { useOpenComponentEditorModal } from '../ComponentEditorModalContext.js';
import type { AtomicSavedInfo } from '../componentEditorModalTypes.js';

export interface OpenVnextComponentInModalButtonProps {
  /** JSON `key` field */
  componentKey: string;
  /** JSON `flow` (e.g. `sys-tasks`, `sys-schemas`) */
  flow: string;
  disabled?: boolean;
  className?: string;
  title?: string;
  /** Default: "Open in modal" */
  label?: string;
  /** Compact icon-only control. */
  iconOnly?: boolean;
  /** After a successful save in the modal; syncs workflow refs from JSON. */
  onAtomicSaved?: (info: AtomicSavedInfo) => void;
}

/**
 * Resolves `key` + `flow` to a workspace file and opens the atomic editor modal.
 * Must be used under `ComponentEditorModalProvider`.
 */
export function OpenVnextComponentInModalButton({
  componentKey,
  flow,
  disabled = false,
  className = '',
  title = 'Open component in modal editor',
  label = 'Open in modal',
  iconOnly = false,
  onAtomicSaved,
}: OpenVnextComponentInModalButtonProps) {
  const projectId = useProjectStore((s) => s.activeProject?.id);
  const projectPath = useProjectStore((s) => s.activeProject?.path);
  const vnextConfig = useProjectStore((s) => s.vnextConfig);
  const openModal = useOpenComponentEditorModal();
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    if (!projectId || !projectPath || !vnextConfig) {
      showNotification({ kind: 'error', message: 'Open a project with vnext.config.' });
      return;
    }
    const k = componentKey?.trim();
    const f = flow?.trim();
    if (!k || !f) {
      showNotification({ kind: 'error', message: 'Reference key and flow are required.' });
      return;
    }
    setLoading(true);
    try {
      const res = await resolveComponentEditorTargetByKeyFlowResult(
        projectId,
        projectPath,
        vnextConfig.paths,
        k,
        f,
      );
      if (!res.ok) {
        const msg =
          res.failure === 'not_found'
            ? 'No matching JSON on disk. Create the file or pick an existing component.'
            : 'Could not map file path to editor route. Check your Tasks/…/… structure.';
        showNotification({ kind: 'error', message: msg });
        return;
      }
      openModal({
        kind: res.target.kind,
        projectId,
        group: res.target.group,
        name: res.target.name,
        onAtomicSaved,
      });
    } catch {
      showNotification({
        kind: 'error',
        message: 'Could not list components. Check connection and project.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={disabled || loading}
      title={title}
      aria-label={iconOnly ? title : undefined}
      className={`text-secondary-icon hover:text-secondary-foreground inline-flex min-h-0 min-w-0 items-center gap-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${className}`.trim()}>
      <SquareArrowOutUpRight className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
      {iconOnly ? null : loading ? '…' : label}
    </button>
  );
}
