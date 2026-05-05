import { useEffect, useRef } from 'react';

interface MenuPosition {
  screenX: number;
  screenY: number;
  flowX: number;
  flowY: number;
}

interface CanvasContextMenuProps {
  position: MenuPosition;
  onClose: () => void;
  onAddState: (stateType: number, subType: number, position: { x: number; y: number }) => void;
  hasInitialState?: boolean;
}

export function CanvasContextMenu({ position, onClose, onAddState, hasInitialState }: CanvasContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const add = (stateType: number, subType = 0) => {
    onAddState(stateType, subType, { x: position.flowX, y: position.flowY });
    onClose();
  };

  return (
    <div
      ref={ref}
      className="fixed z-[100] bg-surface/95 backdrop-blur-xl rounded-xl border border-border shadow-xl shadow-black/10 py-1.5 min-w-[180px] animate-scale-in"
      style={{ left: position.screenX, top: position.screenY }}
    >
      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Add State</div>
      <MenuItem label="Initial State" color="bg-initial" onClick={() => add(1)} disabled={hasInitialState} />
      <MenuItem label="Intermediate State" color="bg-intermediate" onClick={() => add(2)} />
      <div className="border-t border-border-subtle my-1 mx-2" />
      <div className="px-3 py-1 text-[10px] text-muted-foreground font-medium">Final States</div>
      <MenuItem label="Success" color="bg-final-success" indent onClick={() => add(3, 1)} />
      <MenuItem label="Error" color="bg-final-error" indent onClick={() => add(3, 2)} />
      <MenuItem label="Terminated" color="bg-final-terminated" indent onClick={() => add(3, 3)} />
      <MenuItem label="Suspended" color="bg-final-suspended" indent onClick={() => add(3, 4)} />
      <div className="border-t border-border-subtle my-1 mx-2" />
      <MenuItem label="SubFlow State" color="bg-subflow" onClick={() => add(4)} />
    </div>
  );
}

interface NodeContextMenuProps {
  position: { screenX: number; screenY: number };
  nodeId: string;
  onClose: () => void;
  onDeleteState: (key: string) => void;
  onDuplicateState: (key: string) => void;
  onChangeType: (key: string, stateType: number, subType?: number) => void;
  hasInitialState?: boolean;
}

export function NodeContextMenu({ position, nodeId, onClose, onDeleteState, onDuplicateState, onChangeType, hasInitialState }: NodeContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-[100] bg-surface/95 backdrop-blur-xl rounded-xl border border-border shadow-xl shadow-black/10 py-1.5 min-w-[180px] animate-scale-in"
      style={{ left: position.screenX, top: position.screenY }}
    >
      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground truncate">{nodeId}</div>
      <MenuItem label="Duplicate" onClick={() => { onDuplicateState(nodeId); onClose(); }} />
      <div className="border-t border-border-subtle my-1 mx-2" />
      <div className="px-3 py-1 text-[10px] text-muted-foreground font-medium">Change Type</div>
      <MenuItem label="Initial" color="bg-initial" indent onClick={() => { onChangeType(nodeId, 1); onClose(); }} disabled={hasInitialState} />
      <MenuItem label="Intermediate" color="bg-intermediate" indent onClick={() => { onChangeType(nodeId, 2); onClose(); }} />
      <MenuItem label="Final - Success" color="bg-final-success" indent onClick={() => { onChangeType(nodeId, 3, 1); onClose(); }} />
      <MenuItem label="Final - Error" color="bg-final-error" indent onClick={() => { onChangeType(nodeId, 3, 2); onClose(); }} />
      <MenuItem label="SubFlow" color="bg-subflow" indent onClick={() => { onChangeType(nodeId, 4); onClose(); }} />
      <div className="border-t border-border-subtle my-1 mx-2" />
      <MenuItem label="Delete State" danger onClick={() => { onDeleteState(nodeId); onClose(); }} />
    </div>
  );
}

interface EdgeContextMenuProps {
  position: { screenX: number; screenY: number };
  sourceStateKey: string;
  transitionKey: string;
  onClose: () => void;
  onDeleteTransition: (sourceStateKey: string, transitionKey: string) => void;
  onChangeTrigger: (sourceStateKey: string, transitionKey: string, triggerType: number) => void;
}

export function EdgeContextMenu({ position, sourceStateKey, transitionKey, onClose, onDeleteTransition, onChangeTrigger }: EdgeContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-[100] bg-surface/95 backdrop-blur-xl rounded-xl border border-border shadow-xl shadow-black/10 py-1.5 min-w-[170px] animate-scale-in"
      style={{ left: position.screenX, top: position.screenY }}
    >
      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground truncate">{transitionKey}</div>
      <div className="px-3 py-1 text-[10px] text-muted-foreground font-medium">Trigger Type</div>
      <MenuItem label="Manual" color="bg-final-terminated" indent onClick={() => { onChangeTrigger(sourceStateKey, transitionKey, 0); onClose(); }} />
      <MenuItem label="Auto" color="bg-trigger-auto" indent onClick={() => { onChangeTrigger(sourceStateKey, transitionKey, 1); onClose(); }} />
      <MenuItem label="Scheduled" color="bg-trigger-scheduled" indent onClick={() => { onChangeTrigger(sourceStateKey, transitionKey, 2); onClose(); }} />
      <MenuItem label="Event" color="bg-trigger-event" indent onClick={() => { onChangeTrigger(sourceStateKey, transitionKey, 3); onClose(); }} />
      <div className="border-t border-border-subtle my-1 mx-2" />
      <MenuItem label="Delete Transition" danger onClick={() => { onDeleteTransition(sourceStateKey, transitionKey); onClose(); }} />
    </div>
  );
}

function MenuItem({ label, color, indent, danger, onClick, disabled }: {
  label: string;
  color?: string;
  indent?: boolean;
  danger?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors ${
        indent ? 'pl-5' : ''
      } ${
        disabled
          ? 'text-muted-foreground/50 cursor-not-allowed opacity-50'
          : danger
            ? 'text-destructive-text hover:bg-destructive-surface cursor-pointer'
            : 'text-foreground hover:bg-muted-surface cursor-pointer'
      }`}
    >
      {color && <span className={`w-2 h-2 rounded-full ${color} shrink-0`} />}
      {label}
    </button>
  );
}
