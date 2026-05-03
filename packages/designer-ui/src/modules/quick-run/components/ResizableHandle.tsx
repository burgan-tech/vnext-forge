import { useCallback, useEffect, useRef } from 'react';

interface ResizableHandleProps {
  onResize: (delta: number) => void;
  direction?: 'left' | 'right';
}

export function ResizableHandle({ onResize, direction = 'right' }: ResizableHandleProps) {
  const dragging = useRef(false);
  const startX = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - startX.current;
      startX.current = e.clientX;
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
  }, [onResize, direction]);

  return (
    <div
      className="group relative flex w-[5px] cursor-col-resize items-center justify-center hover:bg-[var(--vscode-focusBorder)] active:bg-[var(--vscode-focusBorder)]"
      onMouseDown={handleMouseDown}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
    >
      <div className="h-8 w-[2px] rounded-full bg-[var(--vscode-panel-border)] opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  );
}
