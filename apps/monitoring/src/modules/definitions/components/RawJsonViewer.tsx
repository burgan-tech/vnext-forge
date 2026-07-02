import { useCallback, useRef, useState } from 'react';
import { Button, JsonCodeField } from '@vnext-forge-studio/designer-ui/ui';
import { Copy, Check } from 'lucide-react';

const MIN_HEIGHT = 200;
const MAX_HEIGHT = 900;
const DEFAULT_HEIGHT = 480;

interface RawJsonViewerProps {
  data: unknown;
}

export function RawJsonViewer({ data }: RawJsonViewerProps) {
  const [copied, setCopied] = useState(false);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const heightRef = useRef(DEFAULT_HEIGHT);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(DEFAULT_HEIGHT);

  const json = JSON.stringify(data, null, 2);

  function handleCopy() {
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStartY.current = e.clientY;
    dragStartHeight.current = heightRef.current;

    function onMouseMove(ev: MouseEvent) {
      const next = Math.min(
        MAX_HEIGHT,
        Math.max(MIN_HEIGHT, dragStartHeight.current + ev.clientY - dragStartY.current),
      );
      heightRef.current = next;
      setHeight(next);
    }

    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          className="h-7 w-7"
          aria-label="Copy JSON"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <JsonCodeField
        value={json}
        language="json"
        readOnly
        height={height}
        onChange={() => {}}
      />
      <div
        className="h-1.5 w-full cursor-row-resize rounded-full bg-border transition-colors hover:bg-primary/40"
        onMouseDown={handleMouseDown}
        aria-hidden="true"
      />
    </div>
  );
}
