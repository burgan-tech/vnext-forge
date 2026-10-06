import { useCallback, useEffect, useRef } from 'react';

interface ResizableHandleProps {
  onResize: (delta: number) => void;
  direction?: 'left' | 'right';
  /** 'vertical' = column handle (default); 'horizontal' = row handle. */
  orientation?: 'vertical' | 'horizontal';
  valueNow?: number;
  label?: string;
}

const KEY_STEP = 16;

export function ResizableHandle({
  onResize,
  direction = 'right',
  orientation = 'vertical',
  valueNow,
  label = 'Resize panel',
}: ResizableHandleProps) {
  const dragging = useRef(false);
  const start = useRef(0);
  const horizontal = orientation === 'horizontal';

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      start.current = horizontal ? e.clientY : e.clientX;
      document.body.style.cursor = horizontal ? 'row-resize' : 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [horizontal],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const pos = horizontal ? e.clientY : e.clientX;
      const delta = pos - start.current;
      start.current = pos;
      onResize(direction === 'right' ? delta : -delta);
    };

    const handleMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onResize, direction, horizontal]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const plus = horizontal ? 'ArrowDown' : 'ArrowRight';
      const minus = horizontal ? 'ArrowUp' : 'ArrowLeft';
      if (e.key !== plus && e.key !== minus) return;
      e.preventDefault();
      const step = e.key === plus ? KEY_STEP : -KEY_STEP;
      onResize(direction === 'right' ? step : -step);
    },
    [onResize, direction, horizontal],
  );

  const sizing = horizontal ? 'h-[5px] w-full cursor-row-resize' : 'w-[5px] cursor-col-resize';
  const grip = horizontal ? 'h-[2px] w-8' : 'h-8 w-[2px]';

  return (
    <div
      className={`group relative flex ${sizing} items-center justify-center hover:bg-[var(--vscode-focusBorder)] active:bg-[var(--vscode-focusBorder)] focus-visible:bg-[var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:[&>div]:opacity-100`}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
      role="separator"
      tabIndex={0}
      aria-orientation={orientation}
      aria-valuenow={valueNow}
      aria-label={label}
    >
      <div
        className={`${grip} rounded-full bg-[var(--vscode-panel-border)] opacity-0 transition-opacity motion-reduce:transition-none group-hover:opacity-100`}
      />
    </div>
  );
}
