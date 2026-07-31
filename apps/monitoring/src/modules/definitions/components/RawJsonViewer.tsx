import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  JsonCodeField,
} from '@vnext-forge-studio/designer-ui/ui';
import { Copy, Check, Maximize2 } from 'lucide-react';

const MIN_HEIGHT = 200;
const MAX_HEIGHT = 900;
const DEFAULT_HEIGHT = 480;

/**
 * Vertical space the fullscreen dialog chrome (header band + content padding)
 * takes away from the viewport. `JsonCodeField` only accepts a numeric height,
 * so this is computed rather than expressed in CSS.
 */
const FULLSCREEN_CHROME_PX = 120;
const FULLSCREEN_MIN_HEIGHT = 240;

function fullScreenEditorHeight(): number {
  if (typeof window === 'undefined') return DEFAULT_HEIGHT;
  return Math.max(FULLSCREEN_MIN_HEIGHT, window.innerHeight - FULLSCREEN_CHROME_PX);
}

/** `JsonCodeField` is a controlled component; read-only use still needs a handler. */
const noopChange = () => undefined;

interface RawJsonViewerProps {
  data: unknown;
}

export function RawJsonViewer({ data }: RawJsonViewerProps) {
  const [copied, setCopied] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [fullScreenHeight, setFullScreenHeight] = useState(FULLSCREEN_MIN_HEIGHT);
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

  const openFullScreen = useCallback(() => {
    setFullScreenHeight(fullScreenEditorHeight());
    setFullScreen(true);
  }, []);

  // Keep the fullscreen editor filling the viewport across window resizes.
  useEffect(() => {
    if (!fullScreen || typeof window === 'undefined') return;
    const handleResize = () => setFullScreenHeight(fullScreenEditorHeight());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [fullScreen]);

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
      <div className="flex justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          className="h-7 w-7"
          aria-label="Copy JSON"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={openFullScreen}
          className="h-7 w-7"
          aria-label="Full screen"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <JsonCodeField
        value={json}
        language="json"
        readOnly
        height={height}
        onChange={noopChange}
      />
      <div
        className="h-1.5 w-full cursor-row-resize rounded-full bg-border transition-colors hover:bg-primary/40"
        onMouseDown={handleMouseDown}
        aria-hidden="true"
      />
      <Dialog open={fullScreen} onOpenChange={setFullScreen}>
        <DialogContent className="flex h-screen max-h-screen w-screen max-w-none flex-col gap-0 rounded-none p-0">
          <DialogHeader className="shrink-0">
            <DialogTitle className="truncate font-mono text-sm">Raw JSON</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 p-4">
            <JsonCodeField
              value={json}
              language="json"
              readOnly
              height={fullScreenHeight}
              onChange={noopChange}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
